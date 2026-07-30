(function () {
  const storageKey = "meetily-download-theme";
  const root = document.documentElement;
  const controls = Array.from(document.querySelectorAll('input[name="theme"]'));
  const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function storedTheme() {
    try {
      const value = window.localStorage.getItem(storageKey);
      return ["system", "light", "dark"].includes(value) ? value : "system";
    } catch {
      return "system";
    }
  }

  function applyTheme(mode) {
    const resolved = mode === "system" ? (systemQuery.matches ? "dark" : "light") : mode;
    root.dataset.theme = resolved;
    root.dataset.themeMode = mode;
    controls.forEach((control) => {
      control.checked = control.value === mode;
    });
  }

  function persistTheme(mode) {
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch {
      return;
    }
  }

  controls.forEach((control) => {
    control.addEventListener("change", (event) => {
      const mode = event.target.value;
      persistTheme(mode);
      applyTheme(mode);
    });
  });

  systemQuery.addEventListener("change", () => {
    if (root.dataset.themeMode === "system") {
      applyTheme("system");
    }
  });

  applyTheme(storedTheme());
})();
