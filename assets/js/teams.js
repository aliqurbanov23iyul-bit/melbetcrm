(async function () {
    CRM.bindLayout();
    const user = await CRM.protect();

    if (!user) {
        return;
    }

    async function load() {
        const data = await CRM.api("teams");

        document.getElementById("content").innerHTML = `
            <div class="araclar">
                <button id="takimEkle" class="buton buton-birincil">
                    + Takım Oluştur
                </button>
            </div>

            <div class="takim-karti-grid">
                ${data.items.length
                    ? data.items.map((team) => `
                        <article class="kisi-karti">
                            <div class="kisi-ust">
                                <div class="avatar">T</div>

                                <div>
                                    <b>${CRM.escape(team.name)}</b>
                                    <span>
                                        ${CRM.escape(team.manager || "Takım yöneticisi belirtilmedi")}
                                    </span>
                                </div>
                            </div>

                            <div class="kisi-alt">
                                <span class="rozet">
                                    ${team.member_count} Menejer
                                </span>
                            </div>

                            <div class="kart-aksiyon">
                                <a
                                    class="mini-buton"
                                    href="/takimlar.html?id=${team.id}"
                                >
                                    Takımı Aç
                                </a>

                                <button
                                    class="mini-buton tehlike"
                                    data-team-delete="${team.id}"
                                >
                                    Takımı Sil
                                </button>
                            </div>
                        </article>
                    `).join("")
                    : `
                        <div class="kart bos">
                            Henüz takım oluşturulmadı.
                        </div>
                    `
                }
            </div>

            <div id="takimDetay"></div>
        `;

        document.getElementById("takimEkle").onclick = openCreate;

        document.querySelectorAll("[data-team-delete]").forEach((button) => {
            button.onclick = async () => {
                if (!window.confirm("Bu takımı silmek istediğinizden emin misiniz? Takımdaki menejerler silinmez, sadece takımdan çıkarılır.")) {
                    return;
                }

                try {
                    await CRM.api("team", {
                        method: "DELETE",
                        body: {
                            id: Number(button.dataset.teamDelete)
                        }
                    });

                    CRM.toast("Takım silindi.");
                    window.location.href = "/takimlar.html";
                } catch (err) {
                    CRM.toast(err.message);
                }
            };
        });

        const id = Number(
            new URLSearchParams(window.location.search).get("id")
        );

        if (id) {
            await loadTeamDetail(id);
        }
    }

    function openCreate() {
        CRM.openModal(`
            <h2>Yeni Takım Oluştur</h2>

            <div class="iki-kolon">
                <label class="alan">
                    <span>Takım Adı</span>
                    <input id="takimAdi">
                </label>

                <label class="alan">
                    <span>Takım Yöneticisi</span>
                    <input id="takimYoneticisi">
                </label>
            </div>

            <div class="aksiyonlar">
                <button id="takimKaydet" class="buton buton-birincil">
                    Takımı Oluştur
                </button>
            </div>
        `);

        document.getElementById("takimKaydet").onclick = async () => {
            try {
                await CRM.api("teams", {
                    method: "POST",
                    body: {
                        name: document.getElementById("takimAdi").value,
                        manager: document.getElementById("takimYoneticisi").value
                    }
                });

                CRM.closeModal();
                CRM.toast("Takım oluşturuldu.");
                load();
            } catch (err) {
                CRM.toast(err.message);
            }
        };
    }

    async function loadTeamDetail(id) {
        const data = await CRM.api("team", {
            query: { id }
        });

        document.getElementById("takimDetay").innerHTML = `
            <div class="baslik-satiri">
                <div>
                    <h2>${CRM.escape(data.item.name)}</h2>
                    <div class="soluk">
                        ${CRM.escape(data.item.manager || "Takım yöneticisi belirtilmedi")}
                        ·
                        ${data.members.length} menejer
                    </div>
                </div>

                <button
                    id="menejerEkle"
                    class="buton buton-birincil"
                >
                    + Takıma Menejer Ekle
                </button>
            </div>

            ${CRM.managerCards(data.members, {
                removeText: "Takımdan Çıkar"
            })}
        `;

        CRM.bindTelegramButtons(
            document.getElementById("takimDetay")
        );

        document.querySelectorAll("[data-remove-id]").forEach((button) => {
            button.onclick = async () => {
                try {
                    await CRM.api("team-member", {
                        method: "DELETE",
                        body: {
                            team_id: id,
                            candidate_id: Number(button.dataset.removeId)
                        }
                    });

                    CRM.toast("Menejer takımdan çıkarıldı.");
                    loadTeamDetail(id);
                } catch (err) {
                    CRM.toast(err.message);
                }
            };
        });

        document.getElementById("menejerEkle").onclick = () => {
            openAddMember(id, data.available);
        };
    }

    function openAddMember(teamId, available) {
        CRM.openModal(`
            <h2>Takıma Menejer Ekle</h2>

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
                <button id="takimaEkle" class="buton buton-birincil">
                    Takıma Ekle
                </button>
            </div>
        `);

        document.getElementById("takimaEkle").onclick = async () => {
            const candidateId = Number(
                document.getElementById("menejerSec").value
            );

            if (!candidateId) {
                CRM.toast("Bir menejer seçin.");
                return;
            }

            try {
                await CRM.api("team-member", {
                    method: "POST",
                    body: {
                        team_id: teamId,
                        candidate_id: candidateId
                    }
                });

                CRM.closeModal();
                CRM.toast("Menejer takıma eklendi.");
                loadTeamDetail(teamId);
            } catch (err) {
                CRM.toast(err.message);
            }
        };
    }

    await load();
})();
