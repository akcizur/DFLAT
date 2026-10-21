using UnityEngine;

namespace RetroCRT.URP
{
    /// <summary>Optional desktop frame-rate cap for a retro cadence. Does not change global settings in Edit mode.</summary>
    [DisallowMultipleComponent]
    public sealed class RetroCRTFrameRateCap : MonoBehaviour
    {
        [Range(15, 240)] public int targetFrameRate = 30;
        [Tooltip("Disable VSync while this component is active so targetFrameRate can take effect.")]
        public bool disableVSync = true;

        private int previousTargetFrameRate;
        private int previousVSyncCount;
        private bool captured;

        private void OnEnable()
        {
            if (!Application.isPlaying)
                return;

            previousTargetFrameRate = Application.targetFrameRate;
            previousVSyncCount = QualitySettings.vSyncCount;
            captured = true;

            if (disableVSync)
                QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = Mathf.Clamp(targetFrameRate, 15, 240);
        }

        private void OnDisable()
        {
            if (!Application.isPlaying || !captured)
                return;

            Application.targetFrameRate = previousTargetFrameRate;
            QualitySettings.vSyncCount = previousVSyncCount;
            captured = false;
        }

        private void OnValidate()
        {
            targetFrameRate = Mathf.Clamp(targetFrameRate, 15, 240);
            if (Application.isPlaying && isActiveAndEnabled)
                Application.targetFrameRate = targetFrameRate;
        }
    }
}
