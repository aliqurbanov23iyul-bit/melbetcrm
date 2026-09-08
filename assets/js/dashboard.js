(async function () {
    CRM.bindLayout();
    const user = await CRM.protect();

    if (!user) {
        return;
    }

    try {
        const data = await CRM.api("dashboard");
        const s = data.stats;

        document.getElementById("content").innerHTML = `
            <div class="kartlar">
                ${[
                    ["Toplam Menejer", s.total, "Tüm kayıtlar"],
                    ["Aktif Menejer", s.active, "Arşiv dışındaki kayıtlar"],
                    ["NDA Onaylı", s.ndaApproved, "Sözleşmesi onaylananlar"],
                    ["NDA Bekleyen", s.ndaPending, "İşlem bekleyenler"],
                    ["İşe Alındı", s.hired, "Süreci tamamlananlar"],
                    ["Takım", s.teams, "Aktif ekip yapısı"],
                    ["Eğitim", s.trainings, "Toplam eğitim oturumu"]
                ].map(([label, value, desc]) => `
                    <article class="kart istatistik">
                        <span>${label}</span>
                        <b>${value}</b>
                        <small>${desc}</small>
                    </article>
                `).join("")}
            </div>

            <div class="baslik-satiri">
                <div>
                    <h2>Hızlı İşlemler</h2>
                    <div class="soluk">Sık kullanılan alanlara tek tıkla ulaşın.</div>
                </div>
            </div>

            <div class="hizli-islemler">
                <a class="hizli-kart" href="/adaylar.html">
                    <b>+ Menejer Ekle</b>
                    <span>Yeni menejer kaydı oluşturun.</span>
                </a>

                <a class="hizli-kart" href="/nda.html">
                    <b>NDA Takibi</b>
                    <span>Onaylanan ve bekleyen sözleşmeleri görün.</span>
                </a>

                <a class="hizli-kart" href="/egitimler.html">
                    <b>Eğitim Planla</b>
                    <span>Eğitim ve simülasyon oturumu oluşturun.</span>
                </a>

                <a class="hizli-kart" href="/takimlar.html">
                    <b>Takım Yönet</b>
                    <span>Menejerleri takımlara ekleyip çıkarın.</span>
                </a>
            </div>

            ${user.role === "trainer"
                ? ""
                : `
                    <div class="baslik-satiri">
                        <div>
                            <h2>Son Güncellenen Menejerler</h2>
                            <div class="soluk">
                                En son işlem yapılan kayıtlar
                            </div>
                        </div>
                    </div>

                    ${CRM.managerCards(data.recent)}
                `
            }
        `;

        CRM.bindTelegramButtons();
    } catch (err) {
        document.getElementById("content").innerHTML = `
            <div class="uyari">${CRM.escape(err.message)}</div>
        `;
    }
})();
