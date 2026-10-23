// The BIOS splash is only a short intro. It never starts the game by itself.
// Clicking skips the intro and reveals the real loading state or the ready menu.
const bootScreen = document.getElementById("bootScreen");
if (bootScreen) {
  const dismissBoot = () => bootScreen.remove();
  bootScreen.addEventListener("pointerdown", dismissBoot, { once: true });
  window.addEventListener("keydown", dismissBoot, { once: true, capture: true });
  window.setTimeout(dismissBoot, 280);
}
