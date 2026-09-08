(async function () {
    try {
        await CRM.api("me");
        window.location.href = "/dashboard.html";
        return;
    } catch {
        // Oturum yoksa giriş ekranında kal.
    }

    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const button = document.getElementById("loginBtn");
    const error = document.getElementById("loginError");

    async function login() {
        error.classList.add("hidden");
        button.disabled = true;
        button.textContent = "Giriş yapılıyor...";

        try {
            await CRM.api("login", {
                method: "POST",
                body: {
                    username: username.value.trim(),
                    password: password.value
                }
            });

            window.location.href = "/dashboard.html";
        } catch (err) {
            error.textContent = err.message;
            error.classList.remove("hidden");
        } finally {
            button.disabled = false;
            button.textContent = "Giriş Yap";
        }
    }

    button.onclick = login;

    password.onkeydown = (event) => {
        if (event.key === "Enter") {
            login();
        }
    };
})();
