(() => {
  const form = document.getElementById("loginForm");
  const message = document.getElementById("formMessage");
  const submit = document.getElementById("submitButton");
  const passwordInput = document.getElementById("password");

  document.getElementById("togglePassword").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const showing = passwordInput.type === "text";
    passwordInput.type = showing ? "password" : "text";
    button.textContent = showing ? "Mostrar" : "Ocultar";
    button.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    submit.disabled = true;
    submit.firstChild.textContent = "Verificando…";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: document.getElementById("username").value.trim(),
          password: passwordInput.value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo iniciar sesión.");
      window.location.replace("/");
    } catch (error) {
      message.textContent = error.message === "Failed to fetch"
        ? "No pudimos conectar con el servidor. Verifica que la aplicación esté iniciada."
        : error.message;
      submit.disabled = false;
      submit.firstChild.textContent = "Entrar al panel ";
    }
  });
})();
