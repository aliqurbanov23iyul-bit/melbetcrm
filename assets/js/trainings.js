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
                ${
                    user.role === "trainer"
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
                ${
                    data.items.length
                        ? data.items
                              .map(
                                  (training) => `
                                    <article class="kisi-karti">
                                        <div class="kisi-ust">
                                            <div class="avatar">
                                                E
                                            </div>

                                            <div>
                                                <b>
                                                    ${CRM.escape(
                                                        training.title
                                                    )}
                                                </b>

                                                <span>
                                                    ${CRM.formatDate(
                                                        training.starts_at
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        <div class="kisi-alt">
                                            <span class="rozet">
                                                Eğitmen:
                                                ${CRM.escape(
                                                    training.trainer_name ||
                                                        "Atanmadı"
                                                )}
                                            </span>

                                            <span class="rozet">
                                                ${
                                                    training.participant_count
                                                } Menejer
                                            </span>
                                        </div>

                                        <div class="kart-aksiyon">
                                            <a
                                                class="mini-buton"
                                                href="/egitim-detay.html?id=${
                                                    training.id
                                                }"
                                            >
                                                Eğitimi Aç
                                            </a>

                                            ${
                                                user.role === "trainer"
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
                                `
                              )
                              .join("")
                        : `
                            <div class="kart bos">
                                Henüz eğitim oluşturulmadı.
                            </div>
                        `
                }
            </div>
        `;

        const addButton = document.getElementById("egitimEkle");

        if (addButton) {
            addButton.onclick = openCreate;
        }

        document
            .querySelectorAll("[data-training-delete]")
            .forEach((button) => {
                button.onclick = async () => {
                    const approved = window.confirm(
                        "Bu eğitimi ve katılımcı kayıtlarını silmek istediğinizden emin misiniz?"
                    );

                    if (!approved) {
                        return;
                    }

                    try {
                        await CRM.api("training", {
                            method: "DELETE",
                            body: {
                                id: Number(
                                    button.dataset.trainingDelete
                                )
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
                            <option value="">
                                Eğitmen seçin
                            </option>

                            ${trainers.items
                                .map(
                                    (trainer) => `
                                        <option
                                            value="${trainer.id}"
                                        >
                                            ${CRM.escape(
                                                trainer.name
                                            )}
                                            ·
                                            ${CRM.escape(
                                                CRM.label(
                                                    trainer.role
                                                )
                                            )}
                                        </option>
                                    `
                                )
                                .join("")}
                        </select>
                    </label>

                    <label class="alan tam-satir">
                        <span>
                            Başlangıç Tarihi ve Saati
                        </span>

                        <input
                            id="tarih"
                            type="datetime-local"
                        >
                    </label>

                    <div class="alan tam-satir">
                        <span>
                            Eğitime Eklenecek Menejerler
                        </span>

                        <div class="menejer-secim-araclari">
                            <input
                                id="menejerAra"
                                placeholder="İsim veya Telegram ara..."
                            >

                            <select id="menejerNdaFiltre">
                                <option value="">
                                    Tüm NDA Durumları
                                </option>

                                <option value="onaylandi">
                                    NDA Onaylandı
                                </option>

                                <option value="bekliyor">
                                    NDA Bekliyor
                                </option>

                                <option value="gonderildi">
                                    NDA Gönderildi
                                </option>

                                <option value="reddedildi">
                                    NDA Onaylanmadı
                                </option>
                            </select>

                            <button
                                type="button"
                                id="tumunuSec"
                                class="buton buton-ikincil"
                            >
                                Görünenleri Seç
                            </button>

                            <button
                                type="button"
                                id="secimiTemizle"
                                class="buton buton-ikincil"
                            >
                                Seçimi Temizle
                            </button>
                        </div>

                        <div class="secim-ozet">
                            <b id="seciliSayisi">
                                0
                            </b>
                            menejer seçildi
                        </div>

                        <div
                            id="menejerSecimListesi"
                            class="menejer-secim-grid"
                        >
                            ${
                                managers.items.length
                                    ? managers.items
                                          .map(
                                              (manager) => `
                                                <label
                                                    class="menejer-secim-karti"
                                                    data-name="${CRM.escape(
                                                        `${
                                                            manager.name ||
                                                            ""
                                                        } ${
                                                            manager.telegram ||
                                                            ""
                                                        }`.toLowerCase()
                                                    )}"
                                                    data-nda="${CRM.escape(
                                                        CRM.normalizeNda(
                                                            manager.nda_status
                                                        )
                                                    )}"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        class="menejer-secim-checkbox"
                                                        value="${manager.id}"
                                                    >

                                                    <span
                                                        class="menejer-secim-isaret"
                                                    ></span>

                                                    <div
                                                        class="menejer-secim-bilgi"
                                                    >
                                                        <b>
                                                            ${CRM.escape(
                                                                manager.name ||
                                                                    "İsimsiz Menejer"
                                                            )}
                                                        </b>

                                                        <span>
                                                            ${CRM.escape(
                                                                manager.telegram
                                                            )}
                                                        </span>

                                                        <div
                                                            class="kisi-alt"
                                                        >
                                                            <span
                                                                class="rozet ${CRM.ndaClass(
                                                                    manager.nda_status
                                                                )}"
                                                            >
                                                                NDA:
                                                                ${CRM.escape(
                                                                    CRM.ndaLabel(
                                                                        manager.nda_status
                                                                    )
                                                                )}
                                                            </span>

                                                            ${
                                                                manager.team_name
                                                                    ? `
                                                                        <span
                                                                            class="rozet"
                                                                        >
                                                                            ${CRM.escape(
                                                                                manager.team_name
                                                                            )}
                                                                        </span>
                                                                    `
                                                                    : ""
                                                            }
                                                        </div>
                                                    </div>
                                                </label>
                                            `
                                          )
                                          .join("")
                                    : `
                                        <div class="kart bos">
                                            Sistemde kayıtlı menejer bulunamadı.
                                        </div>
                                    `
                            }
                        </div>
                    </div>

                    <label class="alan tam-satir">
                        <span>Eğitim Notu</span>

                        <textarea
                            id="not"
                            placeholder="Eğitim hakkında açıklama..."
                        ></textarea>
                    </label>
                </div>

                <div class="aksiyonlar">
                    <button
                        id="egitimKaydet"
                        class="buton buton-birincil"
                    >
                        Eğitimi Oluştur
                    </button>
                </div>
            `);

            const searchInput =
                document.getElementById("menejerAra");

            const ndaFilter =
                document.getElementById(
                    "menejerNdaFiltre"
                );

            const cards = [
                ...document.querySelectorAll(
                    ".menejer-secim-karti"
                )
            ];

            function updateSelectedCount() {
                const selectedCount =
                    document.querySelectorAll(
                        ".menejer-secim-checkbox:checked"
                    ).length;

                document.getElementById(
                    "seciliSayisi"
                ).textContent = selectedCount;
            }

            function filterManagers() {
                const searchText =
                    searchInput.value
                        .trim()
                        .toLowerCase();

                const ndaValue =
                    ndaFilter.value;

                cards.forEach((card) => {
                    const nameMatches =
                        !searchText ||
                        card.dataset.name.includes(
                            searchText
                        );

                    const ndaMatches =
                        !ndaValue ||
                        card.dataset.nda === ndaValue;

                    card.style.display =
                        nameMatches && ndaMatches
                            ? ""
                            : "none";
                });
            }

            searchInput.addEventListener(
                "input",
                filterManagers
            );

            ndaFilter.addEventListener(
                "change",
                filterManagers
            );

            document
                .querySelectorAll(
                    ".menejer-secim-checkbox"
                )
                .forEach((checkbox) => {
                    checkbox.addEventListener(
                        "change",
                        updateSelectedCount
                    );
                });

            document.getElementById(
                "tumunuSec"
            ).onclick = () => {
                cards.forEach((card) => {
                    if (
                        card.style.display !==
                        "none"
                    ) {
                        const checkbox =
                            card.querySelector(
                                ".menejer-secim-checkbox"
                            );

                        if (checkbox) {
                            checkbox.checked = true;
                        }
                    }
                });

                updateSelectedCount();
            };

            document.getElementById(
                "secimiTemizle"
            ).onclick = () => {
                document
                    .querySelectorAll(
                        ".menejer-secim-checkbox"
                    )
                    .forEach((checkbox) => {
                        checkbox.checked = false;
                    });

                updateSelectedCount();
            };

            document.getElementById(
                "egitimKaydet"
            ).onclick = async () => {
                try {
                    const rawDate =
                        document.getElementById(
                            "tarih"
                        ).value;

                    if (!rawDate) {
                        throw new Error(
                            "Başlangıç tarihini seçin."
                        );
                    }

                    const managerIds = [
                        ...document.querySelectorAll(
                            ".menejer-secim-checkbox:checked"
                        )
                    ].map((checkbox) =>
                        Number(checkbox.value)
                    );

                    if (!managerIds.length) {
                        throw new Error(
                            "Eğitime en az bir menejer seçin."
                        );
                    }

                    await CRM.api("trainings", {
                        method: "POST",
                        body: {
                            title:
                                document.getElementById(
                                    "baslik"
                                ).value,

                            trainer_admin_id:
                                document.getElementById(
                                    "egitmen"
                                ).value,

                            starts_at:
                                new Date(
                                    rawDate
                                ).toISOString(),

                            candidate_ids:
                                managerIds,

                            note:
                                document.getElementById(
                                    "not"
                                ).value
                        }
                    });

                    CRM.closeModal();

                    CRM.toast(
                        "Eğitim oluşturuldu."
                    );

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
