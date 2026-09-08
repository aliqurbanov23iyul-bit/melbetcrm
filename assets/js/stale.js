(async function () {
    CRM.bindLayout();
    const user = await CRM.protect();

    if (!user) {
        return;
    }

    async function load(days = 30) {
        const data = await CRM.api("stale", {
            query: { days }
        });

        document.getElementById("content").innerHTML = `
            <div class="araclar">
                <select id="gun">
                    ${[7, 14, 30, 60, 90].map((value) => `
                        <option
                            value="${value}"
                            ${Number(days) === value ? "selected" : ""}
                        >
                            ${value}+ gündür iletişim yok
                        </option>
                    `).join("")}
                </select>
            </div>

            <div class="baslik-satiri">
                <div>
                    <h2>${data.items.length} Pasif Menejer</h2>
                    <div class="soluk">
                        Telegram butonuyla hızlıca yeniden iletişim kurabilirsiniz.
                    </div>
                </div>
            </div>

            ${CRM.managerCards(data.items)}
        `;

        CRM.bindTelegramButtons();

        document.getElementById("gun").onchange = (event) => {
            load(event.target.value);
        };
    }

    await load();
})();
