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

    try {
        const data = await CRM.api("logs");

        document.getElementById("content").innerHTML = `
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
        document.getElementById("content").innerHTML = `
            <div class="uyari">${CRM.escape(err.message)}</div>
        `;
    }
})();
