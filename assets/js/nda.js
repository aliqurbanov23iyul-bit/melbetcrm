(async function () {
    CRM.bindLayout();
    const user = await CRM.protect();

    if (!user) {
        return;
    }

    let currentFilter = "all";

    async function load(filter = currentFilter) {
        currentFilter = filter;

        const data = await CRM.api("nda", {
            query: { filter }
        });

        const all = filter === "all"
            ? data.items
            : (await CRM.api("nda", {
                query: { filter: "all" }
            })).items;

        const approved = all.filter((m) =>
            ["onaylandi", "signed", "approved"].includes(m.nda_status)
        ).length;

        const rejected = all.filter((m) =>
            ["reddedildi", "rejected", "failed"].includes(m.nda_status)
        ).length;

        const pending = all.length - approved - rejected;

        document.getElementById("content").innerHTML = `
            <div class="nda-ozet">
                <article class="kart istatistik">
                    <span>Onaylanan</span>
                    <b>${approved}</b>
                    <small>NDA sözleşmesi onaylı</small>
                </article>

                <article class="kart istatistik">
                    <span>Bekleyen</span>
                    <b>${pending}</b>
                    <small>İşlem bekleyen sözleşmeler</small>
                </article>

                <article class="kart istatistik">
                    <span>Onaylanmayan</span>
                    <b>${rejected}</b>
                    <small>Tekrar iletişim gerekenler</small>
                </article>
            </div>

            <div class="filtre-sekmeleri">
                <button
                    class="filtre-sekme ${filter === "all" ? "active" : ""}"
                    data-filter="all"
                >
                    Tümü
                </button>

                <button
                    class="filtre-sekme ${filter === "approved" ? "active" : ""}"
                    data-filter="approved"
                >
                    Onaylananlar
                </button>

                <button
                    class="filtre-sekme ${filter === "pending" ? "active" : ""}"
                    data-filter="pending"
                >
                    Bekleyenler
                </button>

                <button
                    class="filtre-sekme ${filter === "rejected" ? "active" : ""}"
                    data-filter="rejected"
                >
                    Onaylanmayanlar
                </button>
            </div>

            <div class="baslik-satiri">
                <div>
                    <h2>NDA Menejer Listesi</h2>
                    <div class="soluk">
                        Durumu değiştirin veya Telegram üzerinden hızlıca iletişim kurun.
                    </div>
                </div>
            </div>

            <div class="menejer-karti-grid">
                ${data.items.length
                    ? data.items.map((m) => `
                        <article class="kisi-karti">
                            <div class="kisi-ust">
                                <div class="avatar">
                                    ${CRM.escape(
                                        (m.name || m.telegram).charAt(0).toUpperCase()
                                    )}
                                </div>

                                <div>
                                    <b>${CRM.escape(m.name || "İsimsiz Menejer")}</b>
                                    <span>${CRM.escape(m.telegram)}</span>
                                </div>
                            </div>

                            <div class="kisi-alt">
                                <span class="rozet ${CRM.ndaClass(m.nda_status)}">
                                    NDA:
                                    ${CRM.escape(CRM.ndaLabel(m.nda_status))}
                                </span>

                                ${m.team_name
                                    ? `
                                        <span class="rozet">
                                            ${CRM.escape(m.team_name)}
                                        </span>
                                    `
                                    : ""
                                }
                            </div>

                            <label class="alan">
                                <span>NDA Durumunu Değiştir</span>
                                <select id="nda-${m.id}">
                                    ${CRM.options([
                                        "bekliyor",
                                        "gonderildi",
                                        "onaylandi",
                                        "reddedildi"
                                    ], CRM.normalizeNda(m.nda_status))}
                                </select>
                            </label>

                            <div class="kart-aksiyon">
                                <button
                                    class="mini-buton yesil"
                                    data-telegram="${CRM.escape(m.telegram)}"
                                >
                                    Telegram Mesajı
                                </button>

                                <a
                                    class="mini-buton"
                                    href="/aday-detay.html?id=${m.id}"
                                >
                                    Profili Aç
                                </a>

                                <button
                                    class="mini-buton"
                                    data-save-nda="${m.id}"
                                >
                                    NDA Kaydet
                                </button>
                            </div>
                        </article>
                    `).join("")
                    : `
                        <div class="kart bos">
                            Bu filtrede menejer bulunamadı.
                        </div>
                    `
                }
            </div>
        `;

        CRM.bindTelegramButtons();

        document.querySelectorAll("[data-filter]").forEach((button) => {
            button.onclick = () => load(button.dataset.filter);
        });

        document.querySelectorAll("[data-save-nda]").forEach((button) => {
            button.onclick = async () => {
                const id = Number(button.dataset.saveNda);

                try {
                    await CRM.api("nda", {
                        method: "PATCH",
                        body: {
                            id,
                            nda_status: document.getElementById(`nda-${id}`).value
                        }
                    });

                    CRM.toast("NDA durumu güncellendi.");
                    load(currentFilter);
                } catch (err) {
                    CRM.toast(err.message);
                }
            };
        });
    }

    await load();
})();
