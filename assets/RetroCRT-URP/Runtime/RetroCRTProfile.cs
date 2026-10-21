using System;
using UnityEngine;

namespace RetroCRT.URP
{
    [CreateAssetMenu(fileName = "RetroCRT_Profile", menuName = "Retro CRT/Profile")]
    public sealed class RetroCRTProfile : ScriptableObject
    {
        public RetroCRTSettings settings = new RetroCRTSettings();
    }

    [Serializable]
    public sealed class RetroCRTSettings
    {
        [Header("Resolution / pixel look")]
        [Min(16)] public Vector2Int pixelResolution = new Vector2Int(320, 240);
        [Range(0f, 1f)] public float pixelation = 1f;
        [Range(2f, 128f)] public float colorLevels = 32f;
        [Range(0f, 1f)] public float orderedDither = 0.25f;

        [Header("CRT geometry")]
        [Range(0f, 0.2f)] public float curvature = 0.08f;
        [Range(0f, 1f)] public float vignette = 0.2f;
        [Range(0f, 0.03f)] public float chromaticAberration = 0.008f;

        [Header("Display artifacts")]
        [Range(0f, 1f)] public float scanlines = 0.35f;
        [Range(0f, 1f)] public float interlace = 0.18f;
        [Range(0f, 1f)] public float phosphorMask = 0.15f;
        [Range(0f, 0.25f)] public float glow = 0.08f;
        [Range(0f, 0.15f)] public float analogNoise = 0.025f;
        [Range(0f, 0.03f)] public float horizontalJitter = 0.002f;
        [Range(0f, 0.1f)] public float flicker = 0.015f;
    }
}
