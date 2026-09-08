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

            const training = data.item;
            const completed = training.status === "completed";
            const canManage = user.role !== "trainer";

            document.getElementById("content").innerHTML = `
                <div class="kart">
                    <div class="baslik-satiri">
                        <div>
                            <div class="kisi-alt" style="margin-bottom: 10px;">
                                <span class="rozet ${completed ? "yesil" : ""}">
                                    ${completed ? "Tamamlandı" : "Aktif Eğitim"}
                                </span>

                                ${
                                    completed && training.completed_at
                                        ? `
                                            <span class="rozet">
                                                Sonlandırıldı:
                                                ${CRM.formatDate(training.completed_at)}
                                            </span>
                                        `
                                        : ""
                                }
                            </div>

                            <h2>${CRM.escape(training.title)}</h2>

                            <div class="soluk">
                                Eğitmen:
                                ${CRM.escape(training.trainer_name || "Atanmadı")}
                                ·
                                ${CRM.formatDate(training.starts_at)}
                            </div>
                        </div>

                        <div class="aksiyonlar">
                            ${
                                canManage && !completed
                                    ? `
                                        <button
                                            id="egitimDuzenle"
                                            class="buton buton-ikincil"
                                        >
                                            Eğitim Bilgilerini Düzenle
                                        </button>

                                        <button
                                            id="menejerEkle"
                                            class="buton buton-birincil"
                                        >
                                            + Eğitime Menejer Ekle
                                        </button>

                                        <button
                                            id="egitimSonlandir"
                                            class="buton buton-ikincil"
                                        >
                                            Eğitimi Sonlandır
                                        </button>
                                    `
                                    : ""
                            }

                            ${
                                canManage && completed
                                    ? `
                                        <button
                                            id="egitimAktifEt"
                                            class="buton buton-birincil"
                                        >
                                            Tekrar Aktif Et
                                        </button>

                                        <button
                                            id="egitimKaliciSil"
                                            class="buton buton-ikincil"
                                        >
                                            Kalıcı Sil
                                        </button>
                                    `
                                    : ""
                            }

                            <a
                                class="buton buton-ikincil"
                                href="/egitimler.html"
                            >
                                Eğitimlere Dön
                            </a>
                        </div>
                    </div>

                    ${
                        training.note
                            ? `
                                <div class="not">
                                    <b>Eğitim Notu</b>
                                    <br>
                                    ${CRM.escape(training.note)}
                                </div>
                            `
                            : ""
                    }

                    ${
                        completed
                            ? `
                                <div class="uyari" style="margin-top: 16px;">
                                    Bu eğitim sonlandırılmıştır. Kayıtlar görüntülenebilir ancak sonuçlar değiştirilemez.
                                    Düzenleme yapmak için önce eğitimi tekrar aktif edin.
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
                    ${
                        data.participants.length
                            ? data.participants
                                  .map(
                                      (p) => `
                                        <article class="kisi-karti">
                                            <div class="kisi-ust">
                                                <div class="avatar">
                                                    ${CRM.escape(
                                                        (p.name || p.telegram)
                                                            .charAt(0)
                                                            .toUpperCase()
                                                    )}
                                                </div>

                                                <div>
                                                    <b>${CRM.escape(
                                                        p.name || "İsimsiz Menejer"
                                                    )}</b>
                                                    <span>${CRM.escape(
                                                        p.telegram
                                                    )}</span>
                                                </div>
                                            </div>

                                            <div class="kisi-alt">
                                                <span class="rozet ${CRM.ndaClass(
                                                    p.nda_status
                                                )}">
                                                    NDA:
                                                    ${CRM.escape(
                                                        CRM.ndaLabel(
                                                            p.nda_status
                                                        )
                                                    )}
                                                </span>

                                                <span class="rozet">
                                                    Katılım:
                                                    ${CRM.escape(
                                                        CRM.label(p.attendance)
                                                    )}
                                                </span>

                                                <span class="rozet">
                                                    Sonuç:
                                                    ${CRM.escape(
                                                        CRM.label(p.outcome)
                                                    )}
                                                </span>
                                            </div>

                                            <label class="alan">
                                                <span>Katılım</span>
                                                <select
                                                    id="katilim-${p.id}"
                                                    ${completed ? "disabled" : ""}
                                                >
                                                    ${CRM.options(
                                                        [
                                                            "pending",
                                                            "present",
                                                            "absent"
                                                        ],
                                                        p.attendance
                                                    )}
                                                </select>
                                            </label>

                                            <label class="alan">
                                                <span>Sonuç</span>
                                                <select
                                                    id="sonuc-${p.id}"
                                                    ${completed ? "disabled" : ""}
                                                >
                                                    ${CRM.options(
                                                        [
                                                            "pending",
                                                            "passed",
                                                            "failed",
                                                            "practice"
                                                        ],
                                                        p.outcome
                                                    )}
                                                </select>
                                            </label>

                                            <label class="alan">
                                                <span>Eğitmen Notu</span>
                                                <input
                                                    id="not-${p.id}"
                                                    value="${CRM.escape(
                                                        p.trainer_note || ""
                                                    )}"
                                                    placeholder="Kısa not..."
                                                    ${completed ? "readonly" : ""}
                                                >
                                            </label>

                                            <div class="kart-aksiyon">
                                                <button
                                                    class="mini-buton yesil"
                                                    data-telegram="${CRM.escape(
                                                        p.telegram
                                                    )}"
                                                >
                                                    Telegram Mesajı
                                                </button>

                                                <a
                                                    class="mini-buton"
                                                    href="/aday-detay.html?id=${
                                                        p.candidate_id
                                                    }"
                                                >
                                                    Menejer Profili
                                                </a>

                                                ${
                                                    completed
                                                        ? ""
                                                        : `
                                                            <button
                                                                class="mini-buton"
                                                                data-save-participant="${p.id}"
                                                            >
                                                                Sonucu Kaydet
                                                            </button>
                                                        `
                                                }

                                                ${
                                                    canManage && !completed
                                                        ? `
                                                            <button
                                                                class="mini-buton tehlike"
                                                                data-remove-participant="${p.id}"
                                                            >
                                                                Eğitimden Çıkar
                                                            </button>
                                                        `
                                                        : ""
                                                }
                                            </div>
                                        </article>
                                    `
                                  )
                                  .join("")
                            : `
                                <div class="kart bos">
                                    Bu eğitime henüz menejer eklenmedi.
                                </div>
                            `
                    }
                </div>
            `;

            CRM.bindTelegramButtons();

            if (!completed) {
                bindParticipantActions();
            }

            const addButton = document.getElementById("menejerEkle");

            if (addButton) {
                addButton.onclick = () => openAdd(data.available);
            }

            const editButton = document.getElementById("egitimDuzenle");

            if (editButton) {
                editButton.onclick = () => openEdit(training);
            }

            const completeButton =
                document.getElementById("egitimSonlandir");

            if (completeButton) {
                completeButton.onclick = completeTraining;
            }

            const reopenButton =
                document.getElementById("egitimAktifEt");

            if (reopenButton) {
                reopenButton.onclick = reopenTraining;
            }

            const deleteButton =
                document.getElementById("egitimKaliciSil");

            if (deleteButton) {
                deleteButton.onclick = deleteTraining;
            }
        } catch (err) {
            document.getElementById("content").innerHTML = `
                <div class="uyari">${CRM.escape(err.message)}</div>
            `;
        }
    }

    function bindParticipantActions() {
        document
            .querySelectorAll("[data-save-participant]")
            .forEach((button) => {
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

        document
            .querySelectorAll("[data-remove-participant]")
            .forEach((button) => {
                button.onclick = async () => {
                    if (
                        !window.confirm(
                            "Bu menejeri eğitimden çıkarmak istediğinizden emin misiniz?"
                        )
                    ) {
                        return;
                    }

                    try {
                        await CRM.api("training-participant", {
                            method: "DELETE",
                            body: {
                                id: Number(
                                    button.dataset.removeParticipant
                                )
                            }
                        });

                        CRM.toast("Menejer eğitimden çıkarıldı.");
                        load();
                    } catch (err) {
                        CRM.toast(err.message);
                    }
                };
            });
    }

    async function openEdit(training) {
        try {
            const trainers = await CRM.api("trainers");

            CRM.openModal(`
                <h2>Eğitim Bilgilerini Düzenle</h2>

                <div class="iki-kolon">
                    <label class="alan">
                        <span>Eğitim Başlığı</span>
                        <input
                            id="duzenleBaslik"
                            value="${CRM.escape(training.title)}"
                        >
                    </label>

                    <label class="alan">
                        <span>Eğitmen</span>
                        <select id="duzenleEgitmen">
                            <option value="">Atanmadı</option>
                            ${trainers.items
                                .map(
                                    (trainer) => `
                                        <option
                                            value="${trainer.id}"
                                            ${
                                                Number(
                                                    training.trainer_admin_id
                                                ) === Number(trainer.id)
                                                    ? "selected"
                                                    : ""
                                            }
                                        >
                                            ${CRM.escape(trainer.name)}
                                            ·
                                            ${CRM.escape(
                                                CRM.label(trainer.role)
                                            )}
                                        </option>
                                    `
                                )
                                .join("")}
                        </select>
                    </label>

                    <label class="alan tam-satir">
                        <span>Başlangıç Tarihi ve Saati</span>
                        <input
                            id="duzenleTarih"
                            type="datetime-local"
                            value="${toLocalDateTimeValue(
                                training.starts_at
                            )}"
                        >
                    </label>

                    <label class="alan tam-satir">
                        <span>Eğitim Notu</span>
                        <textarea
                            id="duzenleNot"
                            placeholder="Eğitim hakkında açıklama..."
                        >${CRM.escape(training.note || "")}</textarea>
                    </label>
                </div>

                <div class="aksiyonlar">
                    <button
                        id="egitimDuzenlemeKaydet"
                        class="buton buton-birincil"
                    >
                        Değişiklikleri Kaydet
                    </button>
                </div>
            `);

            document.getElementById(
                "egitimDuzenlemeKaydet"
            ).onclick = async () => {
                try {
                    const rawDate =
                        document.getElementById(
                            "duzenleTarih"
                        ).value;

                    if (!rawDate) {
                        throw new Error(
                            "Başlangıç tarihini seçin."
                        );
                    }

                    await CRM.api("training", {
                        method: "PATCH",
                        body: {
                            id,
                            title: document.getElementById(
                                "duzenleBaslik"
                            ).value,
                            trainer_admin_id:
                                document.getElementById(
                                    "duzenleEgitmen"
                                ).value,
                            starts_at:
                                new Date(rawDate).toISOString(),
                            note: document.getElementById(
                                "duzenleNot"
                            ).value
                        }
                    });

                    CRM.closeModal();
                    CRM.toast("Eğitim bilgileri güncellendi.");
                    load();
                } catch (err) {
                    CRM.toast(err.message);
                }
            };
        } catch (err) {
            CRM.toast(err.message);
        }
    }

    function openAdd(available) {
        CRM.openModal(`
            <h2>Eğitime Menejer Ekle</h2>

            <label class="alan">
                <span>Menejer Seçin</span>
                <select id="menejerSec">
                    <option value="">Menejer seçin</option>

                    ${available
                        .map(
                            (m) => `
                                <option value="${m.id}">
                                    ${CRM.escape(
                                        m.name || "İsimsiz"
                                    )}
                                    ·
                                    ${CRM.escape(m.telegram)}
                                    ·
                                    NDA ${CRM.escape(
                                        CRM.ndaLabel(m.nda_status)
                                    )}
                                </option>
                            `
                        )
                        .join("")}
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

    async function completeTraining() {
        if (
            !window.confirm(
                "Bu eğitimi sonlandırmak istediğinizden emin misiniz? Katılımcılar, sonuçlar ve notlar kayıtlı kalacak."
            )
        ) {
            return;
        }

        try {
            await CRM.api("training-complete", {
                method: "POST",
                body: { id }
            });

            CRM.toast("Eğitim sonlandırıldı.");
            load();
        } catch (err) {
            CRM.toast(err.message);
        }
    }

    async function reopenTraining() {
        if (
            !window.confirm(
                "Bu eğitimi tekrar aktif etmek istediğinizden emin misiniz?"
            )
        ) {
            return;
        }

        try {
            await CRM.api("training-reopen", {
                method: "POST",
                body: { id }
            });

            CRM.toast("Eğitim tekrar aktif edildi.");
            load();
        } catch (err) {
            CRM.toast(err.message);
        }
    }

    async function deleteTraining() {
        if (
            !window.confirm(
                "Bu eğitim KALICI olarak silinecek. Katılımcı sonuçları ve notları da silinecek. Devam etmek istiyor musunuz?"
            )
        ) {
            return;
        }

        try {
            await CRM.api("training", {
                method: "DELETE",
                body: { id }
            });

            CRM.toast("Eğitim kalıcı olarak silindi.");
            window.location.href = "/egitimler.html";
        } catch (err) {
            CRM.toast(err.message);
        }
    }

    function toLocalDateTimeValue(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);
        const pad = (number) =>
            String(number).padStart(2, "0");

        return [
            date.getFullYear(),
            "-",
            pad(date.getMonth() + 1),
            "-",
            pad(date.getDate()),
            "T",
            pad(date.getHours()),
            ":",
            pad(date.getMinutes())
        ].join("");
    }

    await load();
})();
