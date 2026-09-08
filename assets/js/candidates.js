(async function () {
    CRM.bindLayout();
    const user = await CRM.protect();

    if (!user) {
        return;
    }

    let lastItems = [];

    async function load() {
        const query = document.getElementById("arama")?.value || "";
        const nda = document.getElementById("ndaFiltre")?.value || "";
        const status = document.getElementById("durumFiltre")?.value || "";
        const teamId = document.getElementById("takimFiltre")?.value || "";

        const [data, teams] = await Promise.all([
            CRM.api("candidates", {
                query: {
                    q: query,
                    nda,
                    status,
                    team_id: teamId
                }
            }),
            CRM.api("teams")
        ]);

        lastItems = data.items;

        document.getElementById("content").innerHTML = `
            <div class="araclar">
                <input
                    id="arama"
                    placeholder="İsim, Telegram veya telefon ara..."
                    value="${CRM.escape(query)}"
                >

                <select id="ndaFiltre">
                    <option value="">Tüm NDA Durumları</option>
                    <option value="bekliyor" ${nda === "bekliyor" ? "selected" : ""}>Bekliyor</option>
                    <option value="gonderildi" ${nda === "gonderildi" ? "selected" : ""}>Gönderildi</option>
                    <option value="onaylandi" ${nda === "onaylandi" ? "selected" : ""}>Onaylandı</option>
                    <option value="reddedildi" ${nda === "reddedildi" ? "selected" : ""}>Onaylanmadı</option>
                </select>

                <select id="durumFiltre">
                    <option value="">Tüm Süreç Durumları</option>
                    ${CRM.options([
                        "new",
                        "contacted",
                        "training_planned",
                        "training_completed",
                        "exam",
                        "simulation",
                        "final_evaluation",
                        "hired"
                    ], status)}
                </select>

                <select id="takimFiltre">
                    <option value="">Tüm Takımlar</option>
                    ${teams.items.map((team) => `
                        <option
                            value="${team.id}"
                            ${String(team.id) === String(teamId) ? "selected" : ""}
                        >
                            ${CRM.escape(team.name)}
                        </option>
                    `).join("")}
                </select>

                <button id="filtrele" class="buton buton-ikincil">
                    Filtrele
                </button>

                <button id="temizle" class="buton buton-ikincil">
                    Temizle
                </button>

                <button id="disaAktar" class="buton buton-ikincil">
                    Listeyi Dışa Aktar
                </button>

                <button id="menejerEkle" class="buton buton-birincil">
                    + Menejer Ekle
                </button>
            </div>

            <div class="baslik-satiri">
                <div>
                    <h2>${data.items.length} Menejer</h2>
                    <div class="soluk">
                        Menejer kartlarından Telegram mesajı gönderebilir veya detay sayfasına geçebilirsiniz.
                    </div>
                </div>
            </div>

            ${CRM.managerCards(data.items)}
        `;

        CRM.bindTelegramButtons();

        document.getElementById("filtrele").onclick = load;

        document.getElementById("temizle").onclick = () => {
            document.getElementById("arama").value = "";
            document.getElementById("ndaFiltre").value = "";
            document.getElementById("durumFiltre").value = "";
            document.getElementById("takimFiltre").value = "";
            load();
        };

        document.getElementById("arama").onkeydown = (event) => {
            if (event.key === "Enter") {
                load();
            }
        };

        document.getElementById("disaAktar").onclick = () => {
            CRM.exportCsv(
                "menejerler.csv",
                [
                    [
                        "ID",
                        "İsim",
                        "Telegram",
                        "Telefon",
                        "NDA",
                        "Süreç Durumu",
                        "Takım",
                        "İşe Alım"
                    ],
                    ...lastItems.map((item) => [
                        item.id,
                        item.name || "",
                        item.telegram,
                        item.phone || "",
                        CRM.label(item.nda_status),
                        CRM.label(item.status),
                        item.team_name || "",
                        CRM.label(item.hiring_status)
                    ])
                ]
            );
        };

        document.getElementById("menejerEkle").onclick = openCreate;
    }

    function openCreate() {
        CRM.openModal(`
            <h2>Yeni Menejer Ekle</h2>

            <div class="iki-kolon">
                <label class="alan">
                    <span>Telegram Kullanıcı Adı</span>
                    <input id="telegram" placeholder="@kullaniciadi">
                </label>

                <label class="alan">
                    <span>İsim (opsiyonel)</span>
                    <input id="isim">
                </label>

                <label class="alan">
                    <span>Telefon (opsiyonel)</span>
                    <input id="telefon">
                </label>

                <label class="alan">
                    <span>NDA Durumu</span>
                    <select id="ndaDurum">
                        ${CRM.options([
                            "bekliyor",
                            "gonderildi",
                            "onaylandi",
                            "reddedildi"
                        ], "bekliyor")}
                    </select>
                </label>

                <label class="alan tam-satir">
                    <span>Süreç Durumu</span>
                    <select id="durum">
                        ${CRM.options([
                            "new",
                            "contacted",
                            "training_planned",
                            "training_completed",
                            "exam",
                            "simulation",
                            "final_evaluation",
                            "hired"
                        ], "new")}
                    </select>
                </label>
            </div>

            <div class="aksiyonlar">
                <button id="kaydet" class="buton buton-birincil">
                    Menejeri Kaydet
                </button>
            </div>
        `);

        document.getElementById("kaydet").onclick = async () => {
            try {
                await CRM.api("candidates", {
                    method: "POST",
                    body: {
                        telegram: document.getElementById("telegram").value,
                        name: document.getElementById("isim").value,
                        phone: document.getElementById("telefon").value,
                        nda_status: document.getElementById("ndaDurum").value,
                        status: document.getElementById("durum").value
                    }
                });

                CRM.closeModal();
                CRM.toast("Menejer eklendi.");
                load();
            } catch (err) {
                CRM.toast(err.message);
            }
        };
    }

    await load();
})();
