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
        window.location.href = "/adaylar.html";
        return;
    }

    async function load() {
        try {
            const [data, teams] = await Promise.all([
                CRM.api("candidate", {
                    query: { id }
                }),
                CRM.api("teams")
            ]);

            const m = data.item;

            document.getElementById("content").innerHTML = `
                <div class="kart">
                    <div class="baslik-satiri">
                        <div>
                            <h2>
                                ${CRM.escape(m.name || "İsimsiz Menejer")}
                            </h2>
                            <div class="soluk">
                                ${CRM.escape(m.telegram)}
                                ·
                                Kayıt #${m.id}
                            </div>
                        </div>

                        <div class="aksiyonlar">
                            <button
                                class="buton buton-yesil"
                                id="telegramMesaj"
                            >
                                Telegram'dan Mesaj Yaz
                            </button>

                            <a
                                class="buton buton-ikincil"
                                href="/adaylar.html"
                            >
                                Menejerlere Dön
                            </a>
                        </div>
                    </div>

                    <div class="kisi-alt">
                        <span class="rozet ${CRM.ndaClass(m.nda_status)}">
                            NDA: ${CRM.escape(CRM.ndaLabel(m.nda_status))}
                        </span>

                        <span class="rozet">
                            Süreç: ${CRM.escape(CRM.label(m.status))}
                        </span>

                        <span class="rozet">
                            Eğitim: ${CRM.escape(CRM.label(m.training_status))}
                        </span>

                        <span class="rozet">
                            Sınav: ${CRM.escape(CRM.label(m.exam_status))}
                        </span>

                        <span class="rozet">
                            Simülasyon: ${CRM.escape(CRM.label(m.simulation_status))}
                        </span>
                    </div>

                    <div class="iki-kolon">
                        <label class="alan">
                            <span>Telegram</span>
                            <input id="telegram" value="${CRM.escape(m.telegram)}">
                        </label>

                        <label class="alan">
                            <span>İsim</span>
                            <input id="isim" value="${CRM.escape(m.name || "")}">
                        </label>

                        <label class="alan">
                            <span>Telefon</span>
                            <input id="telefon" value="${CRM.escape(m.phone || "")}">
                        </label>

                        <label class="alan">
                            <span>Takım</span>
                            <select id="takim">
                                <option value="">Takım Yok</option>
                                ${teams.items.map((team) => `
                                    <option
                                        value="${team.id}"
                                        ${Number(m.team_id) === Number(team.id) ? "selected" : ""}
                                    >
                                        ${CRM.escape(team.name)}
                                    </option>
                                `).join("")}
                            </select>
                        </label>

                        <label class="alan">
                            <span>NDA Durumu</span>
                            <select id="nda">
                                ${CRM.options([
                                    "bekliyor",
                                    "gonderildi",
                                    "onaylandi",
                                    "reddedildi"
                                ], CRM.normalizeNda(m.nda_status))}
                            </select>
                        </label>

                        <label class="alan">
                            <span>Menejer Süreci</span>
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
                                ], m.status)}
                            </select>
                        </label>

                        <label class="alan">
                            <span>Eğitim Durumu</span>
                            <select id="egitim">
                                ${CRM.options([
                                    "not_planned",
                                    "planned",
                                    "completed",
                                    "passed",
                                    "failed"
                                ], m.training_status)}
                            </select>
                        </label>

                        <label class="alan">
                            <span>Sınav Durumu</span>
                            <select id="sinav">
                                ${CRM.options([
                                    "pending",
                                    "passed",
                                    "failed"
                                ], m.exam_status)}
                            </select>
                        </label>

                        <label class="alan">
                            <span>Simülasyon Durumu</span>
                            <select id="simulasyon">
                                ${CRM.options([
                                    "pending",
                                    "passed",
                                    "failed",
                                    "practice"
                                ], m.simulation_status)}
                            </select>
                        </label>

                        <label class="alan">
                            <span>İşe Alım Durumu</span>
                            <select id="iseAlim">
                                ${CRM.options([
                                    "pending",
                                    "hired",
                                    "rejected"
                                ], m.hiring_status)}
                            </select>
                        </label>
                    </div>

                    <div class="aksiyonlar">
                        <button
                            id="bugunIletisim"
                            class="buton buton-ikincil"
                        >
                            Bugün İletişim Kuruldu
                        </button>

                        <button
                            id="arsiv"
                            class="buton buton-ikincil"
                        >
                            ${m.archived ? "Arşivden Çıkar" : "Arşivle"}
                        </button>

                        <button
                            id="sil"
                            class="buton buton-tehlike"
                        >
                            Menejeri Sil
                        </button>

                        <button
                            id="kaydet"
                            class="buton buton-birincil"
                        >
                            Değişiklikleri Kaydet
                        </button>
                    </div>
                </div>

                <div class="baslik-satiri">
                    <div>
                        <h2>Eğitim Geçmişi</h2>
                        <div class="soluk">
                            Menejerin dahil olduğu eğitimler
                        </div>
                    </div>
                </div>

                <div class="egitim-karti-grid">
                    ${data.trainings.length
                        ? data.trainings.map((training) => `
                            <article class="kisi-karti">
                                <div class="kisi-ust">
                                    <div class="avatar">E</div>
                                    <div>
                                        <b>${CRM.escape(training.title)}</b>
                                        <span>${CRM.formatDate(training.starts_at)}</span>
                                    </div>
                                </div>

                                <div class="kisi-alt">
                                    <span class="rozet">
                                        Katılım:
                                        ${CRM.escape(CRM.label(training.attendance))}
                                    </span>

                                    <span class="rozet">
                                        Sonuç:
                                        ${CRM.escape(CRM.label(training.outcome))}
                                    </span>
                                </div>

                                <div class="kart-aksiyon">
                                    <a
                                        class="mini-buton"
                                        href="/egitim-detay.html?id=${training.id}"
                                    >
                                        Eğitimi Aç
                                    </a>
                                </div>
                            </article>
                        `).join("")
                        : `
                            <div class="kart bos">
                                Henüz eğitim kaydı yok.
                            </div>
                        `
                    }
                </div>

                <div class="baslik-satiri">
                    <div>
                        <h2>Menejer Notları</h2>
                        <div class="soluk">
                            Tarihli ve kullanıcı bilgili not geçmişi
                        </div>
                    </div>
                </div>

                <div class="kart">
                    <textarea
                        id="yeniNot"
                        placeholder="Yeni not ekleyin..."
                    ></textarea>

                    <div class="aksiyonlar">
                        <button
                            id="notEkle"
                            class="buton buton-birincil"
                        >
                            Not Ekle
                        </button>
                    </div>

                    ${data.notes.length
                        ? data.notes.map((note) => `
                            <div class="not">
                                ${CRM.escape(note.note)}
                                <br>
                                <small>
                                    ${CRM.escape(note.author_name || "Sistem")}
                                    ·
                                    ${CRM.formatDate(note.created_at)}
                                </small>
                            </div>
                        `).join("")
                        : `
                            <div class="bos">
                                Henüz not eklenmemiş.
                            </div>
                        `
                    }
                </div>
            `;

            document.getElementById("telegramMesaj").onclick = () => {
                CRM.openTelegram(m.telegram);
            };

            document.getElementById("kaydet").onclick = async () => {
                try {
                    await CRM.api("candidate", {
                        method: "PATCH",
                        body: {
                            id,
                            telegram: document.getElementById("telegram").value,
                            name: document.getElementById("isim").value,
                            phone: document.getElementById("telefon").value,
                            team_id: document.getElementById("takim").value,
                            nda_status: document.getElementById("nda").value,
                            status: document.getElementById("durum").value,
                            training_status: document.getElementById("egitim").value,
                            exam_status: document.getElementById("sinav").value,
                            simulation_status: document.getElementById("simulasyon").value,
                            hiring_status: document.getElementById("iseAlim").value
                        }
                    });

                    CRM.toast("Menejer bilgileri kaydedildi.");
                    load();
                } catch (err) {
                    CRM.toast(err.message);
                }
            };

            document.getElementById("bugunIletisim").onclick = async () => {
                try {
                    await CRM.api("candidate-contact", {
                        method: "POST",
                        body: { id }
                    });

                    CRM.toast("İletişim tarihi güncellendi.");
                } catch (err) {
                    CRM.toast(err.message);
                }
            };

            document.getElementById("arsiv").onclick = async () => {
                try {
                    await CRM.api("candidate", {
                        method: "PATCH",
                        body: {
                            id,
                            archived: !m.archived
                        }
                    });

                    CRM.toast("Arşiv durumu güncellendi.");
                    load();
                } catch (err) {
                    CRM.toast(err.message);
                }
            };

            document.getElementById("sil").onclick = async () => {
                const approved = window.confirm(
                    "Bu menejeri kalıcı olarak silmek istediğinizden emin misiniz? Eğitim katılımları ve notları da silinir."
                );

                if (!approved) {
                    return;
                }

                try {
                    await CRM.api("candidate", {
                        method: "DELETE",
                        body: { id }
                    });

                    window.location.href = "/adaylar.html";
                } catch (err) {
                    CRM.toast(err.message);
                }
            };

            document.getElementById("notEkle").onclick = async () => {
                try {
                    await CRM.api("note", {
                        method: "POST",
                        body: {
                            candidate_id: id,
                            note: document.getElementById("yeniNot").value
                        }
                    });

                    CRM.toast("Not eklendi.");
                    load();
                } catch (err) {
                    CRM.toast(err.message);
                }
            };
        } catch (err) {
            document.getElementById("content").innerHTML = `
                <div class="uyari">${CRM.escape(err.message)}</div>
            `;
        }
    }

    await load();
})();
