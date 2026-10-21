using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
#if UNITY_6000_0_OR_NEWER
using UnityEngine.Rendering.RenderGraphModule;
using UnityEngine.Rendering.RenderGraphModule.Util;
#endif

namespace RetroCRT.URP
{
    /// <summary>Fullscreen CRT treatment for URP. Uses Render Graph in Unity 6 and Blitter in URP 14 compatibility mode.</summary>
    public sealed class RetroCRTRendererFeature : ScriptableRendererFeature
    {
        [Header("Shader assets")]
        [Tooltip("Recommended: assign Materials/RetroCRT_PostProcess.mat. If unset, Shader is used, then Shader.Find fallback.")]
        [SerializeField] private Material materialTemplate;
        [SerializeField] private Shader shader;

        [Header("Profile")]
        [SerializeField] private RetroCRTProfile profile;
        [SerializeField] private RetroCRTSettings customSettings = new RetroCRTSettings();

        [Header("Camera / injection")]
        [SerializeField] private bool includeSceneView = false;
        [SerializeField] private RenderPassEvent injectionPoint = RenderPassEvent.AfterRenderingPostProcessing;

        private Material runtimeMaterial;
        private RetroCRTPass retroPass;

        public override void Create()
        {
            DestroyRuntimeObjects();

            Shader selectedShader = materialTemplate != null
                ? materialTemplate.shader
                : (shader != null ? shader : Shader.Find("RetroCRT/CRT Post Process"));

            if (selectedShader == null)
            {
                Debug.LogError("Retro CRT: shader not found. Assign RetroCRT_PostProcess.mat or the RetroCRT/CRT Post Process shader on the Renderer Feature.");
                return;
            }

            runtimeMaterial = CoreUtils.CreateEngineMaterial(selectedShader);
            retroPass = new RetroCRTPass(runtimeMaterial)
            {
                renderPassEvent = injectionPoint
            };
        }

        public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
        {
            if (retroPass == null || runtimeMaterial == null)
                return;

            CameraData cameraData = renderingData.cameraData;
            if (cameraData.renderType == CameraRenderType.Overlay)
                return;

            bool isGameCamera = cameraData.cameraType == CameraType.Game;
            bool isSceneView = cameraData.cameraType == CameraType.SceneView;
            if (!isGameCamera && !(includeSceneView && isSceneView))
                return;

            RetroCRTSettings selectedSettings = profile != null ? profile.settings : customSettings;
            retroPass.SetSettings(selectedSettings);
            renderer.EnqueuePass(retroPass);
        }

        public override void SetupRenderPasses(ScriptableRenderer renderer, in RenderingData renderingData)
        {
            if (retroPass == null)
                return;

            CameraData cameraData = renderingData.cameraData;
            if (cameraData.renderType == CameraRenderType.Overlay)
                return;
            bool isGameCamera = cameraData.cameraType == CameraType.Game;
            bool isSceneView = cameraData.cameraType == CameraType.SceneView;
            if (!isGameCamera && !(includeSceneView && isSceneView))
                return;

            retroPass.SetCameraTarget(renderer.cameraColorTargetHandle, cameraData.cameraTargetDescriptor);
        }

        protected override void Dispose(bool disposing)
        {
            DestroyRuntimeObjects();
        }

        private void DestroyRuntimeObjects()
        {
            if (retroPass != null)
            {
                retroPass.Dispose();
                retroPass = null;
            }

            if (runtimeMaterial != null)
            {
                CoreUtils.Destroy(runtimeMaterial);
                runtimeMaterial = null;
            }
        }
    }

    internal sealed class RetroCRTPass : ScriptableRenderPass
    {
        private static readonly int ResolutionId = Shader.PropertyToID("_RetroResolution");
        private static readonly int PixelationId = Shader.PropertyToID("_Pixelation");
        private static readonly int ColorLevelsId = Shader.PropertyToID("_ColorLevels");
        private static readonly int DitherId = Shader.PropertyToID("_Dither");
        private static readonly int CurvatureId = Shader.PropertyToID("_Curvature");
        private static readonly int VignetteId = Shader.PropertyToID("_Vignette");
        private static readonly int ChromaticId = Shader.PropertyToID("_ChromaticAberration");
        private static readonly int ScanlinesId = Shader.PropertyToID("_Scanlines");
        private static readonly int InterlaceId = Shader.PropertyToID("_Interlace");
        private static readonly int PhosphorId = Shader.PropertyToID("_PhosphorMask");
        private static readonly int GlowId = Shader.PropertyToID("_Glow");
        private static readonly int NoiseId = Shader.PropertyToID("_AnalogNoise");
        private static readonly int JitterId = Shader.PropertyToID("_HorizontalJitter");
        private static readonly int FlickerId = Shader.PropertyToID("_Flicker");

        private static readonly ProfilingSampler Profiling = new ProfilingSampler("Retro CRT Post Process");
        private readonly Material material;
        private RTHandle source;
        private RTHandle temporaryColor;
        private RetroCRTSettings settings = new RetroCRTSettings();

        public RetroCRTPass(Material material)
        {
            this.material = material;
#if UNITY_6000_0_OR_NEWER
            // A sampled active color texture cannot be read from the final back buffer.
            requiresIntermediateTexture = true;
#endif
        }

        public void SetSettings(RetroCRTSettings value)
        {
            settings = value ?? new RetroCRTSettings();
            ApplySettings();
        }

        public void SetCameraTarget(RTHandle target, RenderTextureDescriptor descriptor)
        {
            source = target;
        }

        private void ApplySettings()
        {
            if (material == null || settings == null)
                return;

            float width = Mathf.Max(16, settings.pixelResolution.x);
            float height = Mathf.Max(16, settings.pixelResolution.y);
            material.SetVector(ResolutionId, new Vector4(width, height, 1f / width, 1f / height));
            material.SetFloat(PixelationId, settings.pixelation);
            material.SetFloat(ColorLevelsId, Mathf.Clamp(settings.colorLevels, 2f, 128f));
            material.SetFloat(DitherId, settings.orderedDither);
            material.SetFloat(CurvatureId, settings.curvature);
            material.SetFloat(VignetteId, settings.vignette);
            material.SetFloat(ChromaticId, settings.chromaticAberration);
            material.SetFloat(ScanlinesId, settings.scanlines);
            material.SetFloat(InterlaceId, settings.interlace);
            material.SetFloat(PhosphorId, settings.phosphorMask);
            material.SetFloat(GlowId, settings.glow);
            material.SetFloat(NoiseId, settings.analogNoise);
            material.SetFloat(JitterId, settings.horizontalJitter);
            material.SetFloat(FlickerId, settings.flicker);
        }

        public override void OnCameraSetup(CommandBuffer cmd, ref RenderingData renderingData)
        {
            if (source == null)
                return;

            RenderTextureDescriptor descriptor = renderingData.cameraData.cameraTargetDescriptor;
            descriptor.depthBufferBits = 0;
            descriptor.msaaSamples = 1;
            descriptor.bindMS = false;
            RenderingUtils.ReAllocateIfNeeded(
                ref temporaryColor,
                descriptor,
                FilterMode.Bilinear,
                TextureWrapMode.Clamp,
                name: "_RetroCRT_TemporaryColor");

            ConfigureTarget(source);
        }

        public override void Execute(ScriptableRenderContext context, ref RenderingData renderingData)
        {
            if (material == null || source == null || temporaryColor == null)
                return;

            ApplySettings();
            CommandBuffer cmd = CommandBufferPool.Get("Retro CRT Post Process");
            using (new ProfilingScope(cmd, Profiling))
            {
                Blitter.BlitCameraTexture(cmd, source, temporaryColor, material, 0);
                Blitter.BlitCameraTexture(cmd, temporaryColor, source, material, 1);
            }
            context.ExecuteCommandBuffer(cmd);
            CommandBufferPool.Release(cmd);
        }

#if UNITY_6000_0_OR_NEWER
        public override void RecordRenderGraph(RenderGraph renderGraph, ContextContainer frameData)
        {
            UniversalResourceData resourceData = frameData.Get<UniversalResourceData>();
            UniversalCameraData cameraData = frameData.Get<UniversalCameraData>();

            // URP's back buffer cannot be used as a sampled source texture.
            if (resourceData.isActiveTargetBackBuffer)
                return;

            TextureHandle sourceTexture = resourceData.activeColorTexture;
            if (!sourceTexture.IsValid())
                return;

            RenderTextureDescriptor descriptor = cameraData.cameraTargetDescriptor;
            descriptor.depthBufferBits = 0;
            descriptor.msaaSamples = 1;
            descriptor.bindMS = false;
            TextureHandle destination = UniversalRenderer.CreateRenderGraphTexture(
                renderGraph,
                descriptor,
                "Retro CRT Temporary Color",
                false);

            if (!destination.IsValid())
                return;

            ApplySettings();
            RenderGraphUtils.BlitMaterialParameters effect = new RenderGraphUtils.BlitMaterialParameters(
                sourceTexture, destination, material, 0);
            renderGraph.AddBlitPass(effect, "Retro CRT Effect");

            RenderGraphUtils.BlitMaterialParameters composite = new RenderGraphUtils.BlitMaterialParameters(
                destination, sourceTexture, material, 1);
            renderGraph.AddBlitPass(composite, "Retro CRT Composite");
        }
#endif

        public void Dispose()
        {
            temporaryColor?.Release();
            temporaryColor = null;
            source = null;
        }
    }
}
