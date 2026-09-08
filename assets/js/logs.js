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

    const content = document.getElementById("content");
    const clearButton = document.getElementById("clearLogsBtn");

    async function loadLogs() {
        try {
            const data = await CRM.api("logs");

            if (!data.items.length) {
                content.innerHTML = `
                    <div class="kart">
                        <h3>İşlem kaydı bulunmuyor</h3>
                        <p class="soluk">Henüz görüntülenecek bir işlem kaydı yok.</p>
                    </div>
                `;
                return;
            }

            content.innerHTML = `
                <div class="tablo-kapsayici">
                    <table>
                        <thead>
                            <tr>
                                <th>Zaman</th>
                                <th>Yönetici</th>
                                <th>İşlem</th>
                                <th>Kayıt Türü</th>
                                <th>Kayıt No</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${data.items.map((log) => `
                                <tr>
                                    <td>${CRM.formatDate(log.created_at)}</td>
                                    <td>
                                        ${CRM.escape(
                                            log.admin_name ||
                                            log.username ||
                                            "Sistem"
                                        )}
                                    </td>
                                    <td>${CRM.escape(log.action)}</td>
                                    <td>${CRM.escape(log.entity_type || "—")}</td>
                                    <td>${CRM.escape(log.entity_id || "—")}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (err) {
            content.innerHTML = `
                <div class="uyari">${CRM.escape(err.message)}</div>
            `;
        }
    }

    clearButton?.addEventListener("click", async () => {
        const approved = window.confirm(
            "TÜM işlem kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?"
        );

        if (!approved) {
            return;
        }

        const finalApproval = window.confirm(
            "Son onay: Yalnızca işlem kayıtları silinecek; menejerler, eğitimler, takımlar ve yöneticiler etkilenmeyecek. Silinsin mi?"
        );

        if (!finalApproval) {
            return;
        }

        const originalText = clearButton.textContent;
        clearButton.disabled = true;
        clearButton.textContent = "Siliniyor...";

        try {
            const result = await CRM.api("logs-clear", {
                method: "DELETE"
            });

            CRM.toast(
                `${result.deleted_count || 0} işlem kaydı silindi.`
            );

            await loadLogs();
        } catch (err) {
            CRM.toast(err.message || "İşlem kayıtları silinemedi.");
        } finally {
            clearButton.disabled = false;
            clearButton.textContent = originalText;
        }
    });

    await loadLogs();
})();
