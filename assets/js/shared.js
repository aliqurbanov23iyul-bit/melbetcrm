const CRM = {
    etiketler: {
        new: "Yeni",
        contacted: "İletişim Kuruldu",
        nda_sent: "NDA Gönderildi",
        nda_signed: "NDA Onaylandı",
        training_planned: "Eğitim Planlandı",
        training_completed: "Eğitim Tamamlandı",
        exam: "Sınav Aşaması",
        simulation: "Simülasyon Aşaması",
        final_evaluation: "Son Değerlendirme",
        hired: "İşe Alındı",

        bekliyor: "Bekliyor",
        gonderildi: "Gönderildi",
        onaylandi: "Onaylandı",
        reddedildi: "Onaylanmadı",
        not_sent: "Gönderilmedi",
        sent: "Gönderildi",
        signed: "Onaylandı",
        approved: "Onaylandı",
        rejected: "Onaylanmadı",
        pending: "Bekliyor",

        not_planned: "Planlanmadı",
        planned: "Planlandı",
        completed: "Tamamlandı",
        passed: "Geçti",
        failed: "Kaldı",
        practice: "Pratik Gerekli",

        present: "Katıldı",
        absent: "Katılmadı",

        hr_admin: "İK Yöneticisi",
        trainer: "Eğitmen",
        super_admin: "Süper Yönetici"
    },

    async api(action, options = {}) {
        const params = new URLSearchParams({
            action,
            ...(options.query || {})
        });

        const response = await fetch(`/api/index?${params.toString()}`, {
            method: options.method || "GET",
            headers: options.body
                ? { "Content-Type": "application/json" }
                : {},
            body: options.body
                ? JSON.stringify(options.body)
                : undefined,
            credentials: "same-origin"
        });

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.error || `Sunucu hatası (${response.status})`);
        }

        return data;
    },

    escape(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    },

    label(value) {
        return this.etiketler[value] || value || "—";
    },

    formatDate(value) {
        return value
            ? new Date(value).toLocaleString("tr-TR")
            : "—";
    },

    toast(message) {
        const element = document.getElementById("toast");

        if (!element) {
            return;
        }

        element.textContent = message;
        element.style.display = "block";

        clearTimeout(window.__crmToast);

        window.__crmToast = setTimeout(() => {
            element.style.display = "none";
        }, 2700);
    },

    openModal(html) {
        document.getElementById("modalBody").innerHTML = html;
        document.getElementById("modal").classList.remove("hidden");
    },

    closeModal() {
        document.getElementById("modal").classList.add("hidden");
    },

    options(values, current) {
        return values.map((value) => `
            <option
                value="${value}"
                ${value === current ? "selected" : ""}
            >
                ${this.escape(this.label(value))}
            </option>
        `).join("");
    },

    normalizeNda(value) {
        if (["onaylandi", "signed", "approved"].includes(value)) {
            return "onaylandi";
        }

        if (["reddedildi", "rejected", "failed"].includes(value)) {
            return "reddedildi";
        }

        if (["gonderildi", "sent"].includes(value)) {
            return "gonderildi";
        }

        return "bekliyor";
    },

    ndaLabel(value) {
        return this.label(this.normalizeNda(value));
    },

    ndaClass(value) {
        const normalized = this.normalizeNda(value);

        if (normalized === "onaylandi") {
            return "basarili";
        }

        if (normalized === "reddedildi") {
            return "olumsuz";
        }

        return "bekliyor";
    },

    telegramUrl(value) {
        const username = String(value || "")
            .trim()
            .replace(/^https?:\/\/t\.me\//i, "")
            .replace(/^@/, "")
            .split(/[/?#]/)[0];

        return username
            ? `https://t.me/${encodeURIComponent(username)}`
            : "https://t.me/";
    },

    openTelegram(value) {
        window.open(
            this.telegramUrl(value),
            "_blank",
            "noopener,noreferrer"
        );
    },

    async protect() {
        try {
            const data = await this.api("me");
            const user = data.user;

            const label = document.getElementById("whoami");

            if (label) {
                label.textContent =
                    `${user.name} · ${this.label(user.role)}`;
            }

            document.querySelectorAll(".super-only").forEach((element) => {
                element.style.display =
                    user.role === "super_admin"
                        ? ""
                        : "none";
            });

            return user;
        } catch {
            window.location.href = "/index.html";
            return null;
        }
    },

    bindLayout() {
        const closeButton = document.getElementById("closeModal");
        const modal = document.getElementById("modal");
        const logout = document.getElementById("logoutBtn");

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                () => this.closeModal()
            );
        }

        if (modal) {
            modal.addEventListener("click", (event) => {
                if (event.target.id === "modal") {
                    this.closeModal();
                }
            });
        }

        if (logout) {
            logout.addEventListener("click", async () => {
                try {
                    await this.api("logout", {
                        method: "POST"
                    });
                } finally {
                    window.location.href = "/index.html";
                }
            });
        }
    },

    managerCards(items, options = {}) {
        if (!items?.length) {
            return `
                <div class="kart bos">
                    Kayıt bulunamadı.
                </div>
            `;
        }

        return `
            <div class="menejer-karti-grid">
                ${items.map((item) => `
                    <article class="kisi-karti">
                        <div class="kisi-ust">
                            <div class="avatar">
                                ${this.escape(
                                    (item.name || item.telegram || "M")
                                        .charAt(0)
                                        .toUpperCase()
                                )}
                            </div>

                            <div>
                                <b>${this.escape(item.name || "İsimsiz Menejer")}</b>
                                <span>${this.escape(item.telegram)}</span>
                            </div>
                        </div>

                        <div class="kisi-alt">
                            <span class="rozet ${this.ndaClass(item.nda_status)}">
                                NDA: ${this.escape(this.ndaLabel(item.nda_status))}
                            </span>

                            <span class="rozet">
                                ${this.escape(this.label(item.status))}
                            </span>

                            ${item.team_name
                                ? `
                                    <span class="rozet">
                                        ${this.escape(item.team_name)}
                                    </span>
                                `
                                : ""
                            }
                        </div>

                        <div class="kart-aksiyon">
                            <a
                                class="mini-buton"
                                href="/aday-detay.html?id=${item.id}"
                            >
                                Detay
                            </a>

                            <button
                                class="mini-buton yesil"
                                data-telegram="${this.escape(item.telegram)}"
                            >
                                Telegram Mesajı
                            </button>

                            ${options.removeText
                                ? `
                                    <button
                                        class="mini-buton tehlike"
                                        data-remove-id="${item.id}"
                                    >
                                        ${this.escape(options.removeText)}
                                    </button>
                                `
                                : ""
                            }
                        </div>
                    </article>
                `).join("")}
            </div>
        `;
    },

    bindTelegramButtons(root = document) {
        root.querySelectorAll("[data-telegram]").forEach((button) => {
            button.onclick = () => {
                this.openTelegram(button.dataset.telegram);
            };
        });
    },

    exportCsv(filename, rows) {
        const text = rows
            .map((row) => row.map((cell) => {
                const safe = String(cell ?? "").replaceAll('"', '""');
                return `"${safe}"`;
            }).join(","))
            .join("\n");

        const blob = new Blob(
            ["\uFEFF" + text],
            { type: "text/csv;charset=utf-8" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }
};

window.CRM = CRM;
