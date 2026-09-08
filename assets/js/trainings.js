(async function () {
    CRM.bindLayout();
    const user = await CRM.protect();

    if (!user) {
        return;
    }

    async function load() {
        const data = await CRM.api("trainings");

        document.getElementById("content").innerHTML = `
            <div class="araclar">
                ${user.role === "trainer"
                    ? ""
                    : `
                        <button
                            id="egitimEkle"
                            class="buton buton-birincil"
                        >
                            + Eğitim Oluştur
                        </button>
                    `
                }
            </div>

            <div class="egitim-karti-grid">
                ${data.items.length
                    ? data.items.map((training) => `
                        <article class="kisi-karti">
                            <div class="kisi-ust">
                                <div class="avatar">E</div>

                                <div>
                                    <b>${CRM.escape(training.title)}</b>
                                    <span>
                                        ${CRM.formatDate(training.starts_at)}
                                    </span>
                                </div>
                            </div>

                            <div class="kisi-alt">
                                <span class="rozet">
                                    Eğitmen:
                                    ${CRM.escape(training.trainer_name || "Atanmadı")}
                                </span>

                                <span class="rozet">
                                    ${training.participant_count} Menejer
                                </span>
                            </div>

                            <div class="kart-aksiyon">
                                <a
                                    class="mini-buton"
                                    href="/egitim-detay.html?id=${training.id}"
                                >
                                    Eğitimi Aç
                                </a>

                                ${user.role === "trainer"
                                    ? ""
                                    : `
                                        <button
                                            class="mini-buton tehlike"
                                            data-training-delete="${training.id}"
                                        >
                                            Eğitimi Sil
                                        </button>
                                    `
                                }
                            </div>
                        </article>
                    `).join("")
                    : `
                        <div class="kart bos">
                            Henüz eğitim oluşturulmadı.
                        </div>
                    `
                }
            </div>
        `;

        if (document.getElementById("egitimEkle")) {
            document.getElementById("egitimEkle").onclick = openCreate;
        }

        document.querySelectorAll("[data-training-delete]").forEach((button) => {
            button.onclick = async () => {
                if (!window.confirm("Bu eğitimi ve katılımcı kayıtlarını silmek istediğinizden emin misiniz?")) {
                    return;
                }

                try {
                    await CRM.api("training", {
                        method: "DELETE",
                        body: {
                            id: Number(button.dataset.trainingDelete)
                        }
                    });

                    CRM.toast("Eğitim silindi.");
                    load();
                } catch (err) {
                    CRM.toast(err.message);
                }
            };
        });
    }

    async function openCreate() {
        try {
            const [trainers, managers] = await Promise.all([
                CRM.api("trainers"),
                CRM.api("candidates")
            ]);

            CRM.openModal(`
                <h2>Yeni Eğitim Oluştur</h2>

                <div class="iki-kolon">
                    <label class="alan">
                        <span>Eğitim Başlığı</span>
                        <input
                            id="baslik"
                            value="Simülasyon Pratiği"
                        >
                    </label>

                    <label class="alan">
                        <span>Eğitmen</span>
                        <select id="egitmen">
                            <option value="">Eğitmen seçin</option>

                            ${trainers.items.map((trainer) => `
                                <option value="${trainer.id}">
                                    ${CRM.escape(trainer.name)}
                                    ·
                                    ${CRM.escape(CRM.label(trainer.role))}
                                </option>
                            `).join("")}
                        </select>
                    </label>

                    <label class="alan tam-satir">
                        <span>Başlangıç Tarihi ve Saati</span>
                        <input id="tarih" type="datetime-local">
                    </label>

                    <label class="alan tam-satir">
                        <span>Başlangıçta Eklenecek Menejerler</span>
                        <select id="menejerler" multiple size="10">
                            ${managers.items.map((m) => `
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

                    <label class="alan tam-satir">
                        <span>Eğitim Notu</span>
                        <textarea
                            id="not"
                            placeholder="Eğitim hakkında açıklama..."
                        ></textarea>
                    </label>
                </div>

                <div class="aksiyonlar">
                    <button id="egitimKaydet" class="buton buton-birincil">
                        Eğitimi Oluştur
                    </button>
                </div>
            `);

            document.getElementById("egitimKaydet").onclick = async () => {
                try {
                    const rawDate =
                        document.getElementById("tarih").value;

                    if (!rawDate) {
                        throw new Error("Başlangıç tarihini seçin.");
                    }

                    const managerIds = [
                        ...document.getElementById("menejerler").selectedOptions
                    ].map((option) => Number(option.value));

                    await CRM.api("trainings", {
                        method: "POST",
                        body: {
                            title: document.getElementById("baslik").value,
                            trainer_admin_id: document.getElementById("egitmen").value,
                            starts_at: new Date(rawDate).toISOString(),
                            candidate_ids: managerIds,
                            note: document.getElementById("not").value
                        }
                    });

                    CRM.closeModal();
                    CRM.toast("Eğitim oluşturuldu.");
                    load();
                } catch (err) {
                    CRM.toast(err.message);
                }
            };
        } catch (err) {
            CRM.toast(err.message);
        }
    }

    await load();
})();
