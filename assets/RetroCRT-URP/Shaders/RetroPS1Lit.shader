Shader "RetroCRT/PS1 Lit"
{
    Properties
    {
        [MainTexture] _BaseMap ("Base Texture", 2D) = "white" {}
        [MainColor] _BaseColor ("Tint", Color) = (1,1,1,1)
        [Normal] _NormalMap ("Normal Map", 2D) = "bump" {}
        _NormalScale ("Normal Scale", Range(0,2)) = 1
        _VertexSnap ("Vertex Snap", Range(0,1)) = 0.85
        _RenderResolution ("Virtual Resolution", Vector) = (320,240,0,0)
        _AffineUV ("Affine Texture Mapping", Range(0,1)) = 1
        _TexelLighting ("Vertex / Texel Lighting", Range(0,1)) = 0.75
        _LightingSteps ("Lighting Steps (0 = Off)", Range(0,8)) = 4
        _AmbientColor ("Ambient Light", Color) = (0.25,0.25,0.25,1)
        _DirectIntensity ("Direct Light Intensity", Range(0,2)) = 0.9
        _EmissionColor ("Emission", Color) = (0,0,0,1)
        _Dither ("Dither", Range(0,1)) = 0.25
        _Cutoff ("Alpha Cutoff", Range(0,1)) = 0.5
        [Toggle(_ALPHATEST_ON)] _AlphaClip ("Alpha Clip", Float) = 0
    }

    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" "Queue"="Geometry" }
        LOD 200
        Pass
        {
            Name "UniversalForward"
            Tags { "LightMode"="UniversalForward" }
            Cull Back
            ZWrite On
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile_fog
            #pragma shader_feature_local_fragment _ALPHATEST_ON

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.core/ShaderLibrary/Packing.hlsl"

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            TEXTURE2D(_NormalMap); SAMPLER(sampler_NormalMap);
            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                half4 _BaseColor;
                half4 _AmbientColor;
                half4 _EmissionColor;
                float4 _RenderResolution;
                half _NormalScale;
                half _VertexSnap;
                half _AffineUV;
                half _TexelLighting;
                half _LightingSteps;
                half _DirectIntensity;
                half _Dither;
                half _Cutoff;
                half _AlphaClip;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 tangentOS : TANGENT;
                float2 uv : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float4 tangentWS : TEXCOORD2;
                float2 uv : TEXCOORD3;
                float2 uvAffine : TEXCOORD4;
                float clipW : TEXCOORD5;
                float3 vertexLighting : TEXCOORD6;
                half fogFactor : TEXCOORD7;
            };

            Varyings Vert(Attributes input)
            {
                Varyings output = (Varyings)0;
                float3 positionWS = TransformObjectToWorld(input.positionOS.xyz);
                float4 positionCS = TransformWorldToHClip(positionWS);

                // Snap clip-space vertices to a virtual raster. This is a screen-space approximation of PS1 vertex jitter.
                float2 virtualResolution = max(_RenderResolution.xy * 0.5, float2(1.0, 1.0));
                float2 ndc = positionCS.xy / max(positionCS.w, 0.0001);
                float2 snappedNdc = round(ndc * virtualResolution) / virtualResolution;
                positionCS.xy = lerp(positionCS.xy, snappedNdc * positionCS.w, saturate(_VertexSnap));

                float3 normalWS = normalize(TransformObjectToWorldNormal(input.normalOS));
                Light mainLight = GetMainLight();
                float ndotl = saturate(dot(normalWS, mainLight.direction));
                float3 vertexLighting = _AmbientColor.rgb + mainLight.color * ndotl * _DirectIntensity;

                output.positionCS = positionCS;
                output.positionWS = positionWS;
                output.normalWS = normalWS;
                output.tangentWS = float4(TransformObjectToWorldDir(input.tangentOS.xyz), input.tangentOS.w * GetOddNegativeScale());
                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);
                output.uvAffine = output.uv * positionCS.w;
                output.clipW = positionCS.w;
                output.vertexLighting = vertexLighting;
                output.fogFactor = ComputeFogFactor(positionCS.z);
                return output;
            }

            float Bayer4PS1(float2 pixel)
            {
                float2 p = fmod(floor(pixel), 4.0);
                float x = p.x;
                float y = p.y;
                float value = 0.0;
                if (y < 1.0) value = x < 1.0 ? 0.0 : (x < 2.0 ? 8.0 : (x < 3.0 ? 2.0 : 10.0));
                else if (y < 2.0) value = x < 1.0 ? 12.0 : (x < 2.0 ? 4.0 : (x < 3.0 ? 14.0 : 6.0));
                else if (y < 3.0) value = x < 1.0 ? 3.0 : (x < 2.0 ? 11.0 : (x < 3.0 ? 1.0 : 9.0));
                else value = x < 1.0 ? 15.0 : (x < 2.0 ? 7.0 : (x < 3.0 ? 13.0 : 5.0));
                return value / 16.0 - 0.46875;
            }

            half4 Frag(Varyings input) : SV_Target
            {
                float2 affineUV = input.uvAffine / max(input.clipW, 0.0001);
                float2 uv = lerp(input.uv, affineUV, saturate(_AffineUV));
                half4 baseSample = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv) * _BaseColor;
                #if defined(_ALPHATEST_ON)
                    clip(baseSample.a - _Cutoff);
                #endif

                half3 normalTS = UnpackNormalScale(SAMPLE_TEXTURE2D(_NormalMap, sampler_NormalMap, uv), _NormalScale);
                half3 n = normalize(input.normalWS);
                half3 t = normalize(input.tangentWS.xyz);
                half3 b = normalize(cross(n, t) * input.tangentWS.w);
                half3 normalWS = normalize(t * normalTS.x + b * normalTS.y + n * normalTS.z);

                Light mainLight = GetMainLight();
                half3 perPixelLighting = _AmbientColor.rgb + mainLight.color * saturate(dot(normalWS, mainLight.direction)) * _DirectIntensity;
                half3 lighting = lerp(perPixelLighting, input.vertexLighting, saturate(_TexelLighting));
                if (_LightingSteps >= 2.0)
                    lighting = floor(saturate(lighting) * _LightingSteps + 0.5) / _LightingSteps;

                half3 color = baseSample.rgb * lighting + _EmissionColor.rgb;
                float dither = Bayer4PS1(input.positionCS.xy) * _Dither / max(_LightingSteps, 2.0);
                color += dither;
                color = MixFog(color, input.fogFactor);
                return half4(saturate(color), baseSample.a);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
