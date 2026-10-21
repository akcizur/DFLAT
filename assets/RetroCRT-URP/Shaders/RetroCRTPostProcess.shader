Shader "RetroCRT/CRT Post Process"
{
    Properties
    {
        [HideInInspector] _RetroResolution ("Retro Resolution", Vector) = (320, 240, 0.003125, 0.0041667)
        [HideInInspector] _Pixelation ("Pixelation", Range(0,1)) = 1
        [HideInInspector] _ColorLevels ("Color Levels", Range(2,128)) = 32
        [HideInInspector] _Dither ("Ordered Dither", Range(0,1)) = 0.25
        [HideInInspector] _Curvature ("Curvature", Range(0,0.2)) = 0.08
        [HideInInspector] _Vignette ("Vignette", Range(0,1)) = 0.2
        [HideInInspector] _ChromaticAberration ("Chromatic Aberration", Range(0,0.03)) = 0.008
        [HideInInspector] _Scanlines ("Scanlines", Range(0,1)) = 0.35
        [HideInInspector] _Interlace ("Interlace", Range(0,1)) = 0.18
        [HideInInspector] _PhosphorMask ("Phosphor Mask", Range(0,1)) = 0.15
        [HideInInspector] _Glow ("Glow", Range(0,0.25)) = 0.08
        [HideInInspector] _AnalogNoise ("Analog Noise", Range(0,0.15)) = 0.025
        [HideInInspector] _HorizontalJitter ("Horizontal Jitter", Range(0,0.03)) = 0.002
        [HideInInspector] _Flicker ("Flicker", Range(0,0.1)) = 0.015
    }

    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" }
        ZWrite Off
        ZTest Always
        Cull Off

        Pass
        {
            Name "RetroCRT"
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma target 3.0
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.core/Runtime/Utilities/Blit.hlsl"

            float4 _RetroResolution;
            float _Pixelation;
            float _ColorLevels;
            float _Dither;
            float _Curvature;
            float _Vignette;
            float _ChromaticAberration;
            float _Scanlines;
            float _Interlace;
            float _PhosphorMask;
            float _Glow;
            float _AnalogNoise;
            float _HorizontalJitter;
            float _Flicker;

            float Hash21(float2 p)
            {
                p = frac(p * float2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return frac(p.x * p.y);
            }

            float Bayer4(float2 pixel)
            {
                float2 p = fmod(floor(pixel), 4.0);
                float x = p.x;
                float y = p.y;
                float value = 0.0;
                if (y < 1.0) value = x < 1.0 ? 0.0 : (x < 2.0 ? 8.0 : (x < 3.0 ? 2.0 : 10.0));
                else if (y < 2.0) value = x < 1.0 ? 12.0 : (x < 2.0 ? 4.0 : (x < 3.0 ? 14.0 : 6.0));
                else if (y < 3.0) value = x < 1.0 ? 3.0 : (x < 2.0 ? 11.0 : (x < 3.0 ? 1.0 : 9.0));
                else value = x < 1.0 ? 15.0 : (x < 2.0 ? 7.0 : (x < 3.0 ? 13.0 : 5.0));
                return (value / 16.0) - 0.46875;
            }

            float3 SampleRGB(float2 uv, float2 chromaOffset)
            {
                float r = SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv + chromaOffset).r;
                float g = SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv).g;
                float b = SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv - chromaOffset).b;
                return float3(r, g, b);
            }

            half4 Frag(Varyings input) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(input);

                float2 originalUV = input.texcoord;
                float2 centered = originalUV * 2.0 - 1.0;
                float2 warped = centered;
                warped *= 1.0 + _Curvature * float2(centered.y * centered.y, centered.x * centered.x);
                float2 uv = warped * 0.5 + 0.5;

                // Horizontal analogue jitter is quantized to a 24 Hz cadence.
                float row = floor(uv.y * _RetroResolution.y);
                float frameId = floor(_Time.y * 24.0);
                float jitter = (Hash21(float2(row, frameId)) - 0.5) * _HorizontalJitter;
                uv.x += jitter;

                float2 pixel = uv * _RetroResolution.xy;
                float2 snappedUV = (floor(pixel) + 0.5) / _RetroResolution.xy;
                uv = lerp(uv, snappedUV, saturate(_Pixelation));
                pixel = floor(uv * _RetroResolution.xy);

                float2 chromaOffset = (uv * 2.0 - 1.0) * dot(uv * 2.0 - 1.0, uv * 2.0 - 1.0) * _ChromaticAberration;
                float3 color = SampleRGB(uv, chromaOffset);

                // A low-cost highlight halo rather than a multi-pass bloom chain.
                float2 texel = _RetroResolution.zw * 1.5;
                float3 halo = SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv + float2(texel.x, 0)).rgb;
                halo += SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv - float2(texel.x, 0)).rgb;
                halo += SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv + float2(0, texel.y)).rgb;
                halo += SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv - float2(0, texel.y)).rgb;
                halo *= 0.25;
                float haloLuma = dot(halo, float3(0.2126, 0.7152, 0.0722));
                color += halo * smoothstep(0.55, 0.95, haloLuma) * _Glow;

                // Scanlines and the alternating CRT field are tied to the virtual raster rows.
                float scan = 0.5 + 0.5 * cos((pixel.y + 0.5) * 3.14159265);
                color *= 1.0 - scan * _Scanlines * 0.34;
                float field = fmod(pixel.y + frameId, 2.0);
                color *= 1.0 - (1.0 - field) * _Interlace * 0.12;

                // RGB phosphor triads, with phase locked to screen pixels.
                float phase = fmod(pixel.x, 3.0);
                float3 phosphor = phase < 1.0 ? float3(1.0, 0.77, 0.77)
                    : (phase < 2.0 ? float3(0.77, 1.0, 0.77) : float3(0.77, 0.77, 1.0));
                color *= lerp(1.0, phosphor, _PhosphorMask);

                float2 noiseCell = floor(uv * _RetroResolution.xy);
                float noise = Hash21(noiseCell + frameId * 17.0) - 0.5;
                color += noise * _AnalogNoise;

                float dither = Bayer4(pixel) * _Dither;
                if (_ColorLevels >= 2.0)
                {
                    float levels = max(_ColorLevels - 1.0, 1.0);
                    color = floor(saturate(color) * levels + dither + 0.5) / levels;
                }

                float vignetteAmount = smoothstep(0.25, 1.12, length(centered));
                color *= 1.0 - vignetteAmount * _Vignette;
                color *= 1.0 + sin(_Time.y * 28.0) * _Flicker;

                float inside = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
                color *= inside;
                return half4(saturate(color), 1.0);
            }
            ENDHLSL
        }

        // Pass 1 is deliberately a plain copy so the processed Render Graph texture can be composited back without applying CRT twice.
        Pass
        {
            Name "Copy"
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment FragCopy
            #pragma target 3.0
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.core/Runtime/Utilities/Blit.hlsl"
            half4 FragCopy(Varyings input) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(input);
                return SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, input.texcoord);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
