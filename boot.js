// Keep the BIOS intro from trapping input if its CSS animation is delayed.
const bootScreen = document.getElementById("bootScreen");
if (bootScreen) {
  const dismissBoot = (startGame) => {
    bootScreen.remove();
    if (startGame) document.getElementById("startButton")?.click();
  };
  bootScreen.addEventListener("pointerdown", () => dismissBoot(true), { once: true });
  window.setTimeout(() => dismissBoot(false), 2700);
}
