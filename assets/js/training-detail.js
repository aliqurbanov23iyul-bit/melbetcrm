(async function () {
    CRM.bindLayout();
    const user = await CRM.protect();

    if (!user) {
        return;
    }

    const id = Number(
        new URLSearchParams(window.location.search).get("id")
    );

    if (!id) {
        window.location.href = "/egitimler.html";
        return;
    }

    async function load() {
        try {
            const data = await CRM.api("training", {
                query: { id }
            });

            document.getElementById("content").innerHTML = `
                <div class="kart">
                    <div class="baslik-satiri">
                        <div>
                            <h2>${CRM.escape(data.item.title)}</h2>
                            <div class="soluk">
                                Eğitmen:
                                ${CRM.escape(data.item.trainer_name || "Atanmadı")}
                                ·
                                ${CRM.formatDate(data.item.starts_at)}
                            </div>
                        </div>

                        <div class="aksiyonlar">
                            ${user.role === "trainer"
                                ? ""
                                : `
                                    <button
                                        id="menejerEkle"
                                        class="buton buton-birincil"
                                    >
                                        + Eğitime Menejer Ekle
                                    </button>
                                `
                            }

                            <a
                                class="buton buton-ikincil"
                                href="/egitimler.html"
                            >
                                Eğitimlere Dön
                            </a>
                        </div>
                    </div>

                    ${data.item.note
                        ? `
                            <div class="not">
                                <b>Eğitim Notu</b>
                                <br>
                                ${CRM.escape(data.item.note)}
                            </div>
                        `
                        : ""
                    }
                </div>

                <div class="baslik-satiri">
                    <div>
                        <h2>Katılımcı Menejerler</h2>
                        <div class="soluk">
                            ${data.participants.length} menejer bu eğitime dahil.
                        </div>
                    </div>
                </div>

                <div class="menejer-karti-grid">
                    ${data.participants.length
                        ? data.participants.map((p) => `
                            <article class="kisi-karti">
                                <div class="kisi-ust">
                                    <div class="avatar">
                                        ${CRM.escape(
                                            (p.name || p.telegram).charAt(0).toUpperCase()
                                        )}
                                    </div>

                                    <div>
                                        <b>${CRM.escape(p.name || "İsimsiz Menejer")}</b>
                                        <span>${CRM.escape(p.telegram)}</span>
                                    </div>
                                </div>

                                <div class="kisi-alt">
                                    <span class="rozet ${CRM.ndaClass(p.nda_status)}">
                                        NDA:
                                        ${CRM.escape(CRM.ndaLabel(p.nda_status))}
                                    </span>

                                    <span class="rozet">
                                        Katılım:
                                        ${CRM.escape(CRM.label(p.attendance))}
                                    </span>

                                    <span class="rozet">
                                        Sonuç:
                                        ${CRM.escape(CRM.label(p.outcome))}
                                    </span>
                                </div>

                                <label class="alan">
                                    <span>Katılım</span>
                                    <select id="katilim-${p.id}">
                                        ${CRM.options([
                                            "pending",
                                            "present",
                                            "absent"
                                        ], p.attendance)}
                                    </select>
                                </label>

                                <label class="alan">
                                    <span>Sonuç</span>
                                    <select id="sonuc-${p.id}">
                                        ${CRM.options([
                                            "pending",
                                            "passed",
                                            "failed",
                                            "practice"
                                        ], p.outcome)}
                                    </select>
                                </label>

                                <label class="alan">
                                    <span>Eğitmen Notu</span>
                                    <input
                                        id="not-${p.id}"
                                        value="${CRM.escape(p.trainer_note || "")}"
                                        placeholder="Kısa not..."
                                    >
                                </label>

                                <div class="kart-aksiyon">
                                    <button
                                        class="mini-buton yesil"
                                        data-telegram="${CRM.escape(p.telegram)}"
                                    >
                                        Telegram Mesajı
                                    </button>

                                    <a
                                        class="mini-buton"
                                        href="/aday-detay.html?id=${p.candidate_id}"
                                    >
                                        Menejer Profili
                                    </a>

                                    <button
                                        class="mini-buton"
                                        data-save-participant="${p.id}"
                                    >
                                        Sonucu Kaydet
                                    </button>

                                    ${user.role === "trainer"
                                        ? ""
                                        : `
                                            <button
                                                class="mini-buton tehlike"
                                                data-remove-participant="${p.id}"
                                            >
                                                Eğitimden Çıkar
                                            </button>
                                        `
                                    }
                                </div>
                            </article>
                        `).join("")
                        : `
                            <div class="kart bos">
                                Bu eğitime henüz menejer eklenmedi.
                            </div>
                        `
                    }
                </div>
            `;

            CRM.bindTelegramButtons();

            document.querySelectorAll("[data-save-participant]").forEach((button) => {
                button.onclick = async () => {
                    const participantId =
                        Number(button.dataset.saveParticipant);

                    try {
                        await CRM.api("training-participant", {
                            method: "PATCH",
                            body: {
                                id: participantId,
                                attendance: document.getElementById(
                                    `katilim-${participantId}`
                                ).value,
                                outcome: document.getElementById(
                                    `sonuc-${participantId}`
                                ).value,
                                trainer_note: document.getElementById(
                                    `not-${participantId}`
                                ).value
                            }
                        });

                        CRM.toast("Eğitim sonucu kaydedildi.");
                        load();
                    } catch (err) {
                        CRM.toast(err.message);
                    }
                };
            });

            document.querySelectorAll("[data-remove-participant]").forEach((button) => {
                button.onclick = async () => {
                    if (!window.confirm("Bu menejeri eğitimden çıkarmak istediğinizden emin misiniz?")) {
                        return;
                    }

                    try {
                        await CRM.api("training-participant", {
                            method: "DELETE",
                            body: {
                                id: Number(button.dataset.removeParticipant)
                            }
                        });

                        CRM.toast("Menejer eğitimden çıkarıldı.");
                        load();
                    } catch (err) {
                        CRM.toast(err.message);
                    }
                };
            });

            const addButton = document.getElementById("menejerEkle");

            if (addButton) {
                addButton.onclick = () => openAdd(data.available);
            }
        } catch (err) {
            document.getElementById("content").innerHTML = `
                <div class="uyari">${CRM.escape(err.message)}</div>
            `;
        }
    }

    function openAdd(available) {
        CRM.openModal(`
            <h2>Eğitime Menejer Ekle</h2>

            <label class="alan">
                <span>Menejer Seçin</span>
                <select id="menejerSec">
                    <option value="">Menejer seçin</option>

                    ${available.map((m) => `
                        <option value="${m.id}">
                            ${CRM.escape(m.name || "İsimsiz")}
                            ·
                            ${CRM.escape(m.telegram)}
                            ·
                            NDA ${CRM.escape(CRM.ndaLabel(m.nda_status))}
                        </option>
                    `).join("")}
                </select>
            </label>

            <div class="aksiyonlar">
                <button
                    id="egitimeEkle"
                    class="buton buton-birincil"
                >
                    Eğitime Ekle
                </button>
            </div>
        `);

        document.getElementById("egitimeEkle").onclick = async () => {
            const candidateId =
                Number(document.getElementById("menejerSec").value);

            if (!candidateId) {
                CRM.toast("Bir menejer seçin.");
                return;
            }

            try {
                await CRM.api("training-participant", {
                    method: "POST",
                    body: {
                        training_id: id,
                        candidate_id: candidateId
                    }
                });

                CRM.closeModal();
                CRM.toast("Menejer eğitime eklendi.");
                load();
            } catch (err) {
                CRM.toast(err.message);
            }
        };
    }

    await load();
})();
