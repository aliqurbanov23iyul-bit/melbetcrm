(async function () {
    CRM.bindLayout();
    const user = await CRM.protect();

    if (!user) {
        return;
    }

    if (user.role !== "super_admin") {
        window.location.href = "/dashboard.html";
        return;
    }

    const permissions = [
        {
            key: "managers.read",
            title: "Menejerleri Görüntüle",
            desc: "Menejer listesine ve profillerine erişebilir.",
            group: "Menejer Yönetimi"
        },
        {
            key: "managers.write",
            title: "Menejer Ekle ve Düzenle",
            desc: "Yeni menejer ekleyebilir ve bilgilerini güncelleyebilir.",
            group: "Menejer Yönetimi"
        },
        {
            key: "managers.delete",
            title: "Menejer Silebilir",
            desc: "Menejer kayıtlarını kalıcı olarak silebilir.",
            group: "Menejer Yönetimi"
        },
        {
            key: "telegram.message",
            title: "Telegram Mesajı",
            desc: "Menejerlerin Telegram profiline hızlı geçiş yapabilir.",
            group: "İletişim"
        },
        {
            key: "nda.read",
            title: "NDA Listesini Görüntüle",
            desc: "NDA onay, bekleme ve ret listelerini görebilir.",
            group: "NDA Yönetimi"
        },
        {
            key: "nda.write",
            title: "NDA Durumunu Değiştir",
            desc: "Menejerlerin NDA durumlarını güncelleyebilir.",
            group: "NDA Yönetimi"
        },
        {
            key: "teams.read",
            title: "Takımları Görüntüle",
            desc: "Takım ve takım üyelerini görüntüleyebilir.",
            group: "Takım Yönetimi"
        },
        {
            key: "teams.write",
            title: "Takımları Yönet",
            desc: "Takım oluşturabilir, silebilir, menejer ekleyip çıkarabilir.",
            group: "Takım Yönetimi"
        },
        {
            key: "trainings.read",
            title: "Eğitimleri Görüntüle",
            desc: "Eğitimleri ve katılımcı menejerleri görebilir.",
            group: "Eğitim Yönetimi"
        },
        {
            key: "trainings.write",
            title: "Eğitim Oluştur ve Katılımcı Yönet",
            desc: "Eğitim oluşturabilir, silebilir, menejer ekleyip çıkarabilir.",
            group: "Eğitim Yönetimi"
        },
        {
            key: "trainings.update",
            title: "Eğitim Sonuçlarını Güncelle",
            desc: "Katılım, sınav sonucu ve eğitmen notlarını değiştirebilir.",
            group: "Eğitim Yönetimi"
        },
        {
            key: "admins.read",
            title: "Yöneticileri Görüntüle",
            desc: "Yönetici ve eğitmen hesaplarını görebilir.",
            group: "Sistem Yönetimi"
        },
        {
            key: "admins.write",
            title: "Yönetici Hesaplarını Yönet",
            desc: "Yeni hesap oluşturabilir ve hesap bilgilerini değiştirebilir.",
            group: "Sistem Yönetimi"
        },
        {
            key: "admins.delete",
            title: "Yönetici Silebilir",
            desc: "Ana Süper Yönetici dışındaki hesapları silebilir.",
            group: "Sistem Yönetimi"
        },
        {
            key: "audit.read",
            title: "İşlem Kayıtlarını Gör",
            desc: "CRM üzerinde yapılan önemli işlemleri inceleyebilir.",
            group: "Sistem Yönetimi"
        }
    ];

    const presets = {
        trainer: {
            "managers.read": true,
            "telegram.message": true,
            "nda.read": true,
            "trainings.read": true,
            "trainings.update": true
        },
        hr_admin: {
            "managers.read": true,
            "managers.write": true,
            "telegram.message": true,
            "nda.read": true,
            "nda.write": true,
            "teams.read": true,
            "teams.write": true,
            "trainings.read": true,
            "trainings.write": true,
            "trainings.update": true
        },
        super_admin: Object.fromEntries(
            permissions.map((permission) => [
                permission.key,
                true
            ])
        )
    };

    function roleLabel(role) {
        return CRM.label(role);
    }

    function permissionCards(selected = {}) {
        const groups = [
            ...new Set(
                permissions.map((permission) => permission.group)
            )
        ];

        return groups.map((group) => `
            <section class="izin-bolum">
                <div class="izin-bolum-baslik">
                    ${group}
                </div>

                <div class="izin-grid">
                    ${permissions
                        .filter((permission) => permission.group === group)
                        .map((permission) => `
                            <label class="izin-karti">
                                <input
                                    type="checkbox"
                                    data-permission="${permission.key}"
                                    ${selected[permission.key] ? "checked" : ""}
                                >

                                <span class="izin-isaret"></span>

                                <span class="izin-metin">
                                    <b>${permission.title}</b>
                                    <small>${permission.desc}</small>
                                </span>
                            </label>
                        `).join("")}
                </div>
            </section>
        `).join("");
    }

    function collectPermissions() {
        const result = {};

        document
            .querySelectorAll("[data-permission]")
            .forEach((input) => {
                result[input.dataset.permission] =
                    input.checked;
            });

        return result;
    }

    function applyPreset(role) {
        const selected = presets[role] || {};

        document
            .querySelectorAll("[data-permission]")
            .forEach((input) => {
                input.checked = Boolean(
                    selected[input.dataset.permission]
                );

                input.disabled =
                    role === "super_admin";
            });
    }

    async function load() {
        const data = await CRM.api("admins");

        const active = data.items.filter(
            (item) => item.active
        ).length;

        const trainers = data.items.filter(
            (item) =>
                item.role === "trainer" &&
                item.active
        ).length;

        const superAdmins = data.items.filter(
            (item) =>
                item.role === "super_admin" &&
                item.active
        ).length;

        document.getElementById("content").innerHTML = `
            <div class="kartlar">
                <article class="kart istatistik">
                    <span>Toplam Hesap</span>
                    <b>${data.items.length}</b>
                    <small>Tüm sistem kullanıcıları</small>
                </article>

                <article class="kart istatistik">
                    <span>Aktif Hesap</span>
                    <b>${active}</b>
                    <small>Giriş yapabilen hesaplar</small>
                </article>

                <article class="kart istatistik">
                    <span>Eğitmen</span>
                    <b>${trainers}</b>
                    <small>Aktif eğitmen hesabı</small>
                </article>

                <article class="kart istatistik">
                    <span>Süper Yönetici</span>
                    <b>${superAdmins}</b>
                    <small>Tam yetkili hesaplar</small>
                </article>
            </div>

            <div class="baslik-satiri">
                <div>
                    <h2>Sistem Kullanıcıları</h2>
                    <div class="soluk">
                        Rol, şifre, durum ve tüm yetkileri buradan yönetin.
                    </div>
                </div>

                <button id="yeniYonetici" class="buton buton-birincil">
                    + Yeni Hesap Ekle
                </button>
            </div>

            <div class="tablo-kapsayici">
                <table>
                    <thead>
                        <tr>
                            <th>Hesap</th>
                            <th>Rol</th>
                            <th>Durum</th>
                            <th>Yetki Sayısı</th>
                            <th>Son Güncelleme</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${data.items.map((admin) => `
                            <tr>
                                <td>
                                    <b>${CRM.escape(admin.name)}</b>
                                    <div class="soluk">
                                        @${CRM.escape(admin.username)}
                                    </div>
                                </td>

                                <td>
                                    <span class="rozet">
                                        ${CRM.escape(roleLabel(admin.role))}
                                    </span>
                                </td>

                                <td>
                                    <span class="rozet ${admin.active ? "basarili" : "olumsuz"}">
                                        ${admin.active ? "Aktif" : "Devre Dışı"}
                                    </span>
                                </td>

                                <td>
                                    ${admin.role === "super_admin"
                                        ? "Tüm Yetkiler"
                                        : `${Object.values(admin.permissions || {}).filter(Boolean).length} Yetki`
                                    }
                                </td>

                                <td>
                                    ${CRM.formatDate(
                                        admin.updated_at ||
                                        admin.created_at
                                    )}
                                </td>

                                <td>
                                    <div class="kart-aksiyon">
                                        <button
                                            class="mini-buton"
                                            data-edit="${admin.id}"
                                        >
                                            Düzenle
                                        </button>

                                        ${admin.username.toLowerCase() === "okancoach"
                                            ? ""
                                            : `
                                                <button
                                                    class="mini-buton"
                                                    data-toggle="${admin.id}"
                                                    data-active="${admin.active}"
                                                >
                                                    ${admin.active
                                                        ? "Devre Dışı Bırak"
                                                        : "Aktifleştir"
                                                    }
                                                </button>

                                                <button
                                                    class="mini-buton tehlike"
                                                    data-delete="${admin.id}"
                                                >
                                                    Sil
                                                </button>
                                            `
                                        }
                                    </div>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById("yeniYonetici").onclick = openCreate;

        document.querySelectorAll("[data-edit]").forEach((button) => {
            button.onclick = () => {
                const admin = data.items.find(
                    (item) =>
                        Number(item.id) ===
                        Number(button.dataset.edit)
                );

                openEdit(admin);
            };
        });

        document.querySelectorAll("[data-toggle]").forEach((button) => {
            button.onclick = async () => {
                try {
                    await CRM.api("admin", {
                        method: "PATCH",
                        body: {
                            id: Number(button.dataset.toggle),
                            active:
                                button.dataset.active !== "true"
                        }
                    });

                    CRM.toast("Hesap durumu güncellendi.");
                    load();
                } catch (err) {
                    CRM.toast(err.message);
                }
            };
        });

        document.querySelectorAll("[data-delete]").forEach((button) => {
            button.onclick = async () => {
                if (!window.confirm("Bu yönetici hesabını kalıcı olarak silmek istediğinizden emin misiniz?")) {
                    return;
                }

                try {
                    await CRM.api("admin", {
                        method: "DELETE",
                        body: {
                            id: Number(button.dataset.delete)
                        }
                    });

                    CRM.toast("Yönetici hesabı silindi.");
                    load();
                } catch (err) {
                    CRM.toast(err.message);
                }
            };
        });
    }

    function roleSelector(current = "hr_admin") {
        return `
            <div class="rol-kartlari">
                ${[
                    ["hr_admin", "İK Yöneticisi"],
                    ["trainer", "Eğitmen"],
                    ["super_admin", "Süper Yönetici"]
                ].map(([value, label]) => `
                    <button
                        type="button"
                        class="rol-karti ${value === current ? "active" : ""}"
                        data-role="${value}"
                    >
                        ${label}
                    </button>
                `).join("")}
            </div>

            <input
                id="rol"
                type="hidden"
                value="${current}"
            >
        `;
    }

    function bindRoleCards() {
        document.querySelectorAll("[data-role]").forEach((button) => {
            button.onclick = () => {
                document.querySelectorAll("[data-role]").forEach(
                    (item) => item.classList.remove("active")
                );

                button.classList.add("active");
                document.getElementById("rol").value =
                    button.dataset.role;

                applyPreset(button.dataset.role);
            };
        });
    }

    function openCreate() {
        CRM.openModal(`
            <h2>Yeni Sistem Kullanıcısı</h2>

            <div class="iki-kolon">
                <label class="alan">
                    <span>Kullanıcı Adı</span>
                    <input id="kullaniciAdi">
                </label>

                <label class="alan">
                    <span>İsim</span>
                    <input id="isim">
                </label>

                <label class="alan tam-satir">
                    <span>Şifre</span>
                    <input
                        id="sifre"
                        type="password"
                        placeholder="En az 8 karakter"
                    >
                </label>
            </div>

            <div class="alan">
                <span>Rol</span>
                ${roleSelector("hr_admin")}
            </div>

            <div id="izinler">
                ${permissionCards(presets.hr_admin)}
            </div>

            <div class="aksiyonlar">
                <button id="hesapOlustur" class="buton buton-birincil">
                    Hesabı Oluştur
                </button>
            </div>
        `);

        bindRoleCards();

        document.getElementById("hesapOlustur").onclick = async () => {
            try {
                await CRM.api("admins", {
                    method: "POST",
                    body: {
                        username: document.getElementById("kullaniciAdi").value,
                        name: document.getElementById("isim").value,
                        password: document.getElementById("sifre").value,
                        role: document.getElementById("rol").value,
                        permissions: collectPermissions()
                    }
                });

                CRM.closeModal();
                CRM.toast("Yeni hesap oluşturuldu.");
                load();
            } catch (err) {
                CRM.toast(err.message);
            }
        };
    }

    function openEdit(admin) {
        const selected = admin.role === "super_admin"
            ? presets.super_admin
            : admin.permissions || {};

        CRM.openModal(`
            <h2>Hesabı Düzenle</h2>

            <div class="iki-kolon">
                <label class="alan">
                    <span>Kullanıcı Adı</span>
                    <input
                        value="${CRM.escape(admin.username)}"
                        disabled
                    >
                </label>

                <label class="alan">
                    <span>İsim</span>
                    <input
                        id="isim"
                        value="${CRM.escape(admin.name)}"
                    >
                </label>

                <label class="alan tam-satir">
                    <span>Yeni Şifre (değişmeyecekse boş bırakın)</span>
                    <input id="sifre" type="password">
                </label>
            </div>

            <div class="alan">
                <span>Rol</span>
                ${roleSelector(admin.role)}
            </div>

            <div id="izinler">
                ${permissionCards(selected)}
            </div>

            <div class="aksiyonlar">
                <button id="hesapKaydet" class="buton buton-birincil">
                    Değişiklikleri Kaydet
                </button>
            </div>
        `);

        bindRoleCards();

        if (admin.username.toLowerCase() === "okancoach") {
            document.querySelectorAll("[data-role]").forEach(
                (button) => button.disabled = true
            );

            applyPreset("super_admin");
        } else if (admin.role === "super_admin") {
            applyPreset("super_admin");
        }

        document.getElementById("hesapKaydet").onclick = async () => {
            try {
                const body = {
                    id: admin.id,
                    name: document.getElementById("isim").value,
                    role: document.getElementById("rol").value,
                    permissions: collectPermissions()
                };

                const password =
                    document.getElementById("sifre").value;

                if (password) {
                    body.password = password;
                }

                await CRM.api("admin", {
                    method: "PATCH",
                    body
                });

                CRM.closeModal();
                CRM.toast("Hesap güncellendi.");
                load();
            } catch (err) {
                CRM.toast(err.message);
            }
        };
    }

    await load();
})();
