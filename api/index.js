import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "melbet_session";
const encoder = new TextEncoder();

function send(res, status, data) {
    res.status(status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
}

function parseBody(req) {
    if (!req.body) {
        return {};
    }

    if (typeof req.body === "object") {
        return req.body;
    }

    try {
        return JSON.parse(req.body);
    } catch {
        return {};
    }
}

function getDatabase() {
    const url =
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL;

    if (!url) {
        throw new Error("Neon veritabanı bağlantısı bulunamadı.");
    }

    return neon(url);
}

function getSecret() {
    const secret = String(process.env.SESSION_SECRET || "");

    if (secret.length < 32) {
        throw new Error("SESSION_SECRET en az 32 karakter olmalıdır.");
    }

    return encoder.encode(secret);
}

function getCookie(req, name) {
    const raw = String(req.headers.cookie || "");

    for (const part of raw.split(";")) {
        const [key, ...rest] = part.trim().split("=");

        if (key === name) {
            return decodeURIComponent(rest.join("="));
        }
    }

    return null;
}

async function createSession(user) {
    return new SignJWT({
        uid: user.id,
        username: user.username,
        name: user.name,
        role: user.role
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("12h")
        .sign(getSecret());
}

async function readSession(req) {
    const token = getCookie(req, SESSION_COOKIE);

    if (!token) {
        return null;
    }

    try {
        const result = await jwtVerify(token, getSecret());
        return result.payload;
    } catch {
        return null;
    }
}

function setSession(res, token) {
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`
    );
}

function clearSession(res) {
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );
}

async function ensureSchema(sql) {
    await sql`
        CREATE TABLE IF NOT EXISTS admins (
            id BIGSERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'hr_admin',
            permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS teams (
            id BIGSERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            manager TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS candidates (
            id BIGSERIAL PRIMARY KEY,
            telegram TEXT UNIQUE NOT NULL,
            name TEXT,
            phone TEXT,
            status TEXT NOT NULL DEFAULT 'new',
            nda_status TEXT NOT NULL DEFAULT 'bekliyor',
            team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
            training_status TEXT NOT NULL DEFAULT 'not_planned',
            exam_status TEXT NOT NULL DEFAULT 'pending',
            simulation_status TEXT NOT NULL DEFAULT 'pending',
            hiring_status TEXT NOT NULL DEFAULT 'pending',
            last_contact_at TIMESTAMPTZ,
            archived BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS candidate_notes (
            id BIGSERIAL PRIMARY KEY,
            candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
            note TEXT NOT NULL,
            author_admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS trainings (
            id BIGSERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            trainer_admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
            starts_at TIMESTAMPTZ NOT NULL,
            note TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS training_participants (
            id BIGSERIAL PRIMARY KEY,
            training_id BIGINT NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
            candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
            attendance TEXT NOT NULL DEFAULT 'pending',
            outcome TEXT NOT NULL DEFAULT 'pending',
            trainer_note TEXT,
            UNIQUE(training_id, candidate_id)
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id BIGSERIAL PRIMARY KEY,
            admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_candidates_updated
        ON candidates(updated_at DESC)
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_candidates_nda
        ON candidates(nda_status)
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_candidates_team
        ON candidates(team_id)
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_training_participants_training
        ON training_participants(training_id)
    `;
}

async function ensurePrimarySuperAdmin(sql) {
    const username = "okancoach";

    const existing = await sql`
        SELECT id
        FROM admins
        WHERE LOWER(username) = LOWER(${username})
        LIMIT 1
    `;

    if (existing.length) {
        return;
    }

    const password = String(process.env.SUPERADMIN_PASSWORD || "");

    if (password.length < 8) {
        throw new Error(
            "SUPERADMIN_PASSWORD ayarlanmamış veya 8 karakterden kısa."
        );
    }

    const hash = await bcrypt.hash(password, 12);

    await sql`
        INSERT INTO admins (
            username,
            name,
            password_hash,
            role,
            permissions
        )
        VALUES (
            ${username},
            'Okan',
            ${hash},
            'super_admin',
            '{}'::jsonb
        )
    `;
}

async function getCurrentUser(sql, req) {
    const session = await readSession(req);

    if (!session?.uid) {
        return null;
    }

    const rows = await sql`
        SELECT
            id,
            username,
            name,
            role,
            permissions,
            active
        FROM admins
        WHERE id = ${session.uid}
        LIMIT 1
    `;

    return rows[0]?.active ? rows[0] : null;
}

function can(user, permission) {
    if (!user) {
        return false;
    }

    if (user.role === "super_admin") {
        return true;
    }

    if (user.role === "trainer") {
        return [
            "managers.read",
            "nda.read",
            "trainings.read",
            "trainings.update",
            "telegram.message"
        ].includes(permission);
    }

    const permissions = user.permissions || {};

    if (permissions[permission]) {
        return true;
    }

    /*
     * Önceki CRM sürümünde oluşturulan hesapların yetkileri de
     * güncellemeden sonra çalışmaya devam etsin.
     */
    const legacyAliases = {
        "managers.read": ["candidates.read"],
        "managers.write": ["candidates.write"],
        "nda.read": ["candidates.read"],
        "nda.write": ["candidates.write"],
        "teams.read": ["teams.write", "candidates.read"],
        "trainings.read": ["trainings.write", "trainings.update"],
        "telegram.message": ["candidates.read"],
        "admins.delete": ["admins.write"]
    };

    return Boolean(
        (legacyAliases[permission] || [])
            .some((legacyKey) => permissions[legacyKey])
    );
}

function requireUser(user, res, permission = null) {
    if (!user) {
        send(res, 401, {
            ok: false,
            error: "Oturum bulunamadı."
        });

        return false;
    }

    if (permission && !can(user, permission)) {
        send(res, 403, {
            ok: false,
            error: "Bu işlem için yetkiniz yok."
        });

        return false;
    }

    return true;
}

async function writeLog(sql, user, action, entityType = null, entityId = null) {
    try {
        await sql`
            INSERT INTO audit_logs (
                admin_id,
                action,
                entity_type,
                entity_id
            )
            VALUES (
                ${user?.id || null},
                ${action},
                ${entityType},
                ${entityId ? String(entityId) : null}
            )
        `;
    } catch {
        // Log hatası ana işlemi bozmaz.
    }
}

function like(value) {
    return `%${String(value || "").trim().slice(0, 80)}%`;
}

export default async function handler(req, res) {
    try {
        const sql = getDatabase();

        await ensureSchema(sql);
        await ensurePrimarySuperAdmin(sql);

        const action = String(req.query?.action || "");
        const method = req.method || "GET";

        if (action === "health") {
            const now = await sql`SELECT NOW() AS now`;

            return send(res, 200, {
                ok: true,
                database: true,
                superAdmin: "okancoach",
                time: now[0].now
            });
        }

        if (action === "login" && method === "POST") {
            const input = parseBody(req);
            const username = String(input.username || "").trim();
            const password = String(input.password || "");

            const rows = await sql`
                SELECT *
                FROM admins
                WHERE LOWER(username) = LOWER(${username})
                LIMIT 1
            `;

            const user = rows[0];

            if (
                !user ||
                !user.active ||
                !(await bcrypt.compare(password, user.password_hash))
            ) {
                return send(res, 401, {
                    ok: false,
                    error: "Kullanıcı adı veya şifre hatalı."
                });
            }

            setSession(res, await createSession(user));

            await writeLog(
                sql,
                user,
                "Giriş yapıldı",
                "Yönetici",
                user.id
            );

            return send(res, 200, {
                ok: true,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    permissions: user.permissions
                }
            });
        }

        if (action === "logout" && method === "POST") {
            clearSession(res);

            return send(res, 200, {
                ok: true
            });
        }

        const user = await getCurrentUser(sql, req);

        if (action === "me") {
            if (!requireUser(user, res)) {
                return;
            }

            return send(res, 200, {
                ok: true,
                user
            });
        }

        if (action === "dashboard") {
            if (!requireUser(user, res)) {
                return;
            }

            const [
                total,
                active,
                hired,
                ndaApproved,
                ndaPending,
                teams,
                trainings
            ] = await Promise.all([
                sql`SELECT COUNT(*)::int n FROM candidates`,
                sql`SELECT COUNT(*)::int n FROM candidates WHERE archived = false`,
                sql`SELECT COUNT(*)::int n FROM candidates WHERE hiring_status = 'hired' AND archived = false`,
                sql`
                    SELECT COUNT(*)::int n
                    FROM candidates
                    WHERE nda_status IN ('onaylandi', 'signed', 'approved')
                    AND archived = false
                `,
                sql`
                    SELECT COUNT(*)::int n
                    FROM candidates
                    WHERE nda_status NOT IN ('onaylandi', 'signed', 'approved')
                    AND archived = false
                `,
                sql`SELECT COUNT(*)::int n FROM teams`,
                user.role === "trainer"
                    ? sql`
                        SELECT COUNT(*)::int n
                        FROM trainings
                        WHERE trainer_admin_id = ${user.id}
                    `
                    : sql`SELECT COUNT(*)::int n FROM trainings`
            ]);

            const recent = user.role === "trainer"
                ? []
                : await sql`
                    SELECT
                        c.id,
                        c.telegram,
                        c.name,
                        c.status,
                        c.nda_status,
                        c.hiring_status,
                        c.updated_at,
                        t.name AS team_name
                    FROM candidates c
                    LEFT JOIN teams t
                        ON t.id = c.team_id
                    WHERE c.archived = false
                    ORDER BY c.updated_at DESC
                    LIMIT 10
                `;

            return send(res, 200, {
                ok: true,
                stats: {
                    total: total[0].n,
                    active: active[0].n,
                    hired: hired[0].n,
                    ndaApproved: ndaApproved[0].n,
                    ndaPending: ndaPending[0].n,
                    teams: teams[0].n,
                    trainings: trainings[0].n
                },
                recent
            });
        }

        if (action === "candidates" && method === "GET") {
            if (!requireUser(user, res, "managers.read")) {
                return;
            }

            const query = String(req.query?.q || "").trim();
            const archived = String(req.query?.archived || "false") === "true";
            const nda = String(req.query?.nda || "").trim();
            const status = String(req.query?.status || "").trim();
            const teamId = Number(req.query?.team_id || 0);

            const rows = await sql`
                SELECT
                    c.*,
                    t.name AS team_name
                FROM candidates c
                LEFT JOIN teams t
                    ON t.id = c.team_id
                WHERE
                    c.archived = ${archived}
                    AND (
                        ${query} = ''
                        OR c.telegram ILIKE ${like(query)}
                        OR COALESCE(c.name, '') ILIKE ${like(query)}
                        OR COALESCE(c.phone, '') ILIKE ${like(query)}
                    )
                    AND (
                        ${nda} = ''
                        OR (
                            ${nda} = 'onaylandi'
                            AND c.nda_status IN ('onaylandi', 'signed', 'approved')
                        )
                        OR (
                            ${nda} = 'reddedildi'
                            AND c.nda_status IN ('reddedildi', 'rejected', 'failed')
                        )
                        OR (
                            ${nda} = 'gonderildi'
                            AND c.nda_status IN ('gonderildi', 'sent')
                        )
                        OR (
                            ${nda} = 'bekliyor'
                            AND c.nda_status IN ('bekliyor', 'not_sent', 'pending')
                        )
                    )
                    AND (
                        ${status} = ''
                        OR c.status = ${status}
                    )
                    AND (
                        ${teamId} = 0
                        OR c.team_id = ${teamId}
                    )
                ORDER BY c.updated_at DESC
                LIMIT 500
            `;

            return send(res, 200, {
                ok: true,
                items: rows
            });
        }

        if (action === "candidates" && method === "POST") {
            if (!requireUser(user, res, "managers.write")) {
                return;
            }

            const input = parseBody(req);
            const telegram = String(input.telegram || "").trim();

            if (!telegram) {
                return send(res, 400, {
                    ok: false,
                    error: "Telegram kullanıcı adı zorunludur."
                });
            }

            try {
                const rows = await sql`
                    INSERT INTO candidates (
                        telegram,
                        name,
                        phone,
                        status,
                        nda_status,
                        last_contact_at
                    )
                    VALUES (
                        ${telegram},
                        ${String(input.name || "").trim() || null},
                        ${String(input.phone || "").trim() || null},
                        ${String(input.status || "new")},
                        ${String(input.nda_status || "bekliyor")},
                        NOW()
                    )
                    RETURNING *
                `;

                await writeLog(
                    sql,
                    user,
                    "Menejer eklendi",
                    "Menejer",
                    rows[0].id
                );

                return send(res, 201, {
                    ok: true,
                    item: rows[0]
                });
            } catch (error) {
                if (
                    String(error.message)
                        .toLowerCase()
                        .includes("unique")
                ) {
                    return send(res, 409, {
                        ok: false,
                        error: "Bu Telegram hesabı zaten kayıtlı."
                    });
                }

                throw error;
            }
        }

        if (action === "candidate" && method === "GET") {
            if (!requireUser(user, res, "managers.read")) {
                return;
            }

            const id = Number(req.query?.id);

            const rows = await sql`
                SELECT
                    c.*,
                    t.name AS team_name
                FROM candidates c
                LEFT JOIN teams t
                    ON t.id = c.team_id
                WHERE c.id = ${id}
                LIMIT 1
            `;

            if (!rows[0]) {
                return send(res, 404, {
                    ok: false,
                    error: "Menejer bulunamadı."
                });
            }

            const notes = await sql`
                SELECT
                    n.*,
                    a.name AS author_name
                FROM candidate_notes n
                LEFT JOIN admins a
                    ON a.id = n.author_admin_id
                WHERE n.candidate_id = ${id}
                ORDER BY n.created_at DESC
            `;

            const trainings = await sql`
                SELECT
                    tr.id,
                    tr.title,
                    tr.starts_at,
                    tp.attendance,
                    tp.outcome
                FROM training_participants tp
                JOIN trainings tr
                    ON tr.id = tp.training_id
                WHERE tp.candidate_id = ${id}
                ORDER BY tr.starts_at DESC
            `;

            return send(res, 200, {
                ok: true,
                item: rows[0],
                notes,
                trainings
            });
        }

        if (action === "candidate" && method === "PATCH") {
            if (!requireUser(user, res, "managers.write")) {
                return;
            }

            const input = parseBody(req);
            const id = Number(input.id);

            const current = (
                await sql`
                    SELECT *
                    FROM candidates
                    WHERE id = ${id}
                    LIMIT 1
                `
            )[0];

            if (!current) {
                return send(res, 404, {
                    ok: false,
                    error: "Menejer bulunamadı."
                });
            }

            const teamId =
                input.team_id === "" ||
                input.team_id === null
                    ? null
                    : input.team_id !== undefined
                        ? Number(input.team_id)
                        : current.team_id;

            const rows = await sql`
                UPDATE candidates
                SET
                    telegram = ${
                        input.telegram !== undefined
                            ? String(input.telegram).trim()
                            : current.telegram
                    },
                    name = ${
                        input.name !== undefined
                            ? String(input.name).trim() || null
                            : current.name
                    },
                    phone = ${
                        input.phone !== undefined
                            ? String(input.phone).trim() || null
                            : current.phone
                    },
                    status = ${input.status ?? current.status},
                    nda_status = ${input.nda_status ?? current.nda_status},
                    team_id = ${teamId},
                    training_status = ${
                        input.training_status ?? current.training_status
                    },
                    exam_status = ${input.exam_status ?? current.exam_status},
                    simulation_status = ${
                        input.simulation_status ?? current.simulation_status
                    },
                    hiring_status = ${
                        input.hiring_status ?? current.hiring_status
                    },
                    archived = ${
                        input.archived !== undefined
                            ? Boolean(input.archived)
                            : current.archived
                    },
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING *
            `;

            await writeLog(
                sql,
                user,
                "Menejer güncellendi",
                "Menejer",
                id
            );

            return send(res, 200, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "candidate" && method === "DELETE") {
            if (!requireUser(user, res, "managers.delete")) {
                return;
            }

            const input = parseBody(req);
            const id = Number(input.id || req.query?.id);

            const removed = await sql`
                DELETE FROM candidates
                WHERE id = ${id}
                RETURNING id
            `;

            if (!removed.length) {
                return send(res, 404, {
                    ok: false,
                    error: "Menejer bulunamadı."
                });
            }

            await writeLog(
                sql,
                user,
                "Menejer kalıcı olarak silindi",
                "Menejer",
                id
            );

            return send(res, 200, {
                ok: true
            });
        }

        if (action === "candidate-contact" && method === "POST") {
            if (!requireUser(user, res, "managers.write")) {
                return;
            }

            const id = Number(parseBody(req).id);

            const rows = await sql`
                UPDATE candidates
                SET
                    last_contact_at = NOW(),
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING *
            `;

            return send(res, 200, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "note" && method === "POST") {
            if (!requireUser(user, res, "managers.write")) {
                return;
            }

            const input = parseBody(req);
            const candidateId = Number(input.candidate_id);
            const note = String(input.note || "").trim();

            if (!note) {
                return send(res, 400, {
                    ok: false,
                    error: "Not boş olamaz."
                });
            }

            const rows = await sql`
                INSERT INTO candidate_notes (
                    candidate_id,
                    note,
                    author_admin_id
                )
                VALUES (
                    ${candidateId},
                    ${note},
                    ${user.id}
                )
                RETURNING *
            `;

            await writeLog(
                sql,
                user,
                "Menejer notu eklendi",
                "Menejer",
                candidateId
            );

            return send(res, 201, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "nda" && method === "GET") {
            if (!requireUser(user, res, "nda.read")) {
                return;
            }

            const filter = String(req.query?.filter || "all");

            const rows = await sql`
                SELECT
                    c.*,
                    t.name AS team_name
                FROM candidates c
                LEFT JOIN teams t
                    ON t.id = c.team_id
                WHERE
                    c.archived = false
                    AND (
                        ${filter} = 'all'
                        OR (
                            ${filter} = 'approved'
                            AND c.nda_status IN ('onaylandi', 'signed', 'approved')
                        )
                        OR (
                            ${filter} = 'pending'
                            AND c.nda_status IN ('bekliyor', 'not_sent', 'sent', 'gonderildi', 'pending')
                        )
                        OR (
                            ${filter} = 'rejected'
                            AND c.nda_status IN ('reddedildi', 'rejected', 'failed')
                        )
                    )
                ORDER BY c.updated_at DESC
            `;

            return send(res, 200, {
                ok: true,
                items: rows
            });
        }

        if (action === "nda" && method === "PATCH") {
            if (!requireUser(user, res, "nda.write")) {
                return;
            }

            const input = parseBody(req);
            const id = Number(input.id);
            const ndaStatus = String(input.nda_status || "bekliyor");

            const rows = await sql`
                UPDATE candidates
                SET
                    nda_status = ${ndaStatus},
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING *
            `;

            await writeLog(
                sql,
                user,
                "NDA durumu güncellendi",
                "Menejer",
                id
            );

            return send(res, 200, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "teams" && method === "GET") {
            if (!requireUser(user, res, "teams.read")) {
                return;
            }

            const rows = await sql`
                SELECT
                    t.*,
                    COUNT(c.id)::int AS member_count
                FROM teams t
                LEFT JOIN candidates c
                    ON c.team_id = t.id
                    AND c.archived = false
                GROUP BY t.id
                ORDER BY t.name
            `;

            return send(res, 200, {
                ok: true,
                items: rows
            });
        }

        if (action === "teams" && method === "POST") {
            if (!requireUser(user, res, "teams.write")) {
                return;
            }

            const input = parseBody(req);
            const name = String(input.name || "").trim();

            if (!name) {
                return send(res, 400, {
                    ok: false,
                    error: "Takım adı zorunludur."
                });
            }

            const rows = await sql`
                INSERT INTO teams (
                    name,
                    manager
                )
                VALUES (
                    ${name},
                    ${String(input.manager || "").trim() || null}
                )
                RETURNING *
            `;

            await writeLog(
                sql,
                user,
                "Takım oluşturuldu",
                "Takım",
                rows[0].id
            );

            return send(res, 201, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "team" && method === "GET") {
            if (!requireUser(user, res, "teams.read")) {
                return;
            }

            const id = Number(req.query?.id);

            const item = (
                await sql`
                    SELECT *
                    FROM teams
                    WHERE id = ${id}
                `
            )[0];

            if (!item) {
                return send(res, 404, {
                    ok: false,
                    error: "Takım bulunamadı."
                });
            }

            const members = await sql`
                SELECT
                    c.*,
                    t.name AS team_name
                FROM candidates c
                LEFT JOIN teams t
                    ON t.id = c.team_id
                WHERE
                    c.team_id = ${id}
                    AND c.archived = false
                ORDER BY c.updated_at DESC
            `;

            const available = await sql`
                SELECT
                    id,
                    telegram,
                    name,
                    nda_status,
                    status
                FROM candidates
                WHERE
                    archived = false
                    AND (
                        team_id IS NULL
                        OR team_id <> ${id}
                    )
                ORDER BY updated_at DESC
                LIMIT 500
            `;

            return send(res, 200, {
                ok: true,
                item,
                members,
                available
            });
        }

        if (action === "team-member" && method === "POST") {
            if (!requireUser(user, res, "teams.write")) {
                return;
            }

            const input = parseBody(req);
            const teamId = Number(input.team_id);
            const candidateId = Number(input.candidate_id);

            const rows = await sql`
                UPDATE candidates
                SET
                    team_id = ${teamId},
                    updated_at = NOW()
                WHERE id = ${candidateId}
                RETURNING *
            `;

            await writeLog(
                sql,
                user,
                "Menejer takıma eklendi",
                "Takım",
                teamId
            );

            return send(res, 200, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "team-member" && method === "DELETE") {
            if (!requireUser(user, res, "teams.write")) {
                return;
            }

            const input = parseBody(req);
            const teamId = Number(input.team_id);
            const candidateId = Number(input.candidate_id);

            const rows = await sql`
                UPDATE candidates
                SET
                    team_id = NULL,
                    updated_at = NOW()
                WHERE
                    id = ${candidateId}
                    AND team_id = ${teamId}
                RETURNING *
            `;

            await writeLog(
                sql,
                user,
                "Menejer takımdan çıkarıldı",
                "Takım",
                teamId
            );

            return send(res, 200, {
                ok: true,
                item: rows[0] || null
            });
        }

        if (action === "team" && method === "DELETE") {
            if (!requireUser(user, res, "teams.write")) {
                return;
            }

            const input = parseBody(req);
            const id = Number(input.id || req.query?.id);

            await sql`
                UPDATE candidates
                SET team_id = NULL
                WHERE team_id = ${id}
            `;

            const removed = await sql`
                DELETE FROM teams
                WHERE id = ${id}
                RETURNING id
            `;

            if (!removed.length) {
                return send(res, 404, {
                    ok: false,
                    error: "Takım bulunamadı."
                });
            }

            await writeLog(
                sql,
                user,
                "Takım silindi",
                "Takım",
                id
            );

            return send(res, 200, {
                ok: true
            });
        }

        if (action === "trainers") {
            if (!requireUser(user, res, "trainings.read")) {
                return;
            }

            const rows = await sql`
                SELECT
                    id,
                    username,
                    name,
                    role
                FROM admins
                WHERE
                    active = true
                    AND role IN (
                        'trainer',
                        'hr_admin',
                        'super_admin'
                    )
                ORDER BY name
            `;

            return send(res, 200, {
                ok: true,
                items: rows
            });
        }

        if (action === "trainings" && method === "GET") {
            if (!requireUser(user, res, "trainings.read")) {
                return;
            }

            const rows = user.role === "trainer"
                ? await sql`
                    SELECT
                        tr.*,
                        a.name AS trainer_name,
                        COUNT(tp.id)::int AS participant_count
                    FROM trainings tr
                    LEFT JOIN admins a
                        ON a.id = tr.trainer_admin_id
                    LEFT JOIN training_participants tp
                        ON tp.training_id = tr.id
                    WHERE tr.trainer_admin_id = ${user.id}
                    GROUP BY tr.id, a.name
                    ORDER BY tr.starts_at DESC
                `
                : await sql`
                    SELECT
                        tr.*,
                        a.name AS trainer_name,
                        COUNT(tp.id)::int AS participant_count
                    FROM trainings tr
                    LEFT JOIN admins a
                        ON a.id = tr.trainer_admin_id
                    LEFT JOIN training_participants tp
                        ON tp.training_id = tr.id
                    GROUP BY tr.id, a.name
                    ORDER BY tr.starts_at DESC
                `;

            return send(res, 200, {
                ok: true,
                items: rows
            });
        }

        if (action === "trainings" && method === "POST") {
            if (!requireUser(user, res, "trainings.write")) {
                return;
            }

            const input = parseBody(req);

            if (!input.starts_at) {
                return send(res, 400, {
                    ok: false,
                    error: "Eğitim başlangıç tarihi zorunludur."
                });
            }

            const rows = await sql`
                INSERT INTO trainings (
                    title,
                    trainer_admin_id,
                    starts_at,
                    note
                )
                VALUES (
                    ${String(input.title || "Eğitim").trim()},
                    ${
                        input.trainer_admin_id
                            ? Number(input.trainer_admin_id)
                            : null
                    },
                    ${input.starts_at},
                    ${String(input.note || "").trim() || null}
                )
                RETURNING *
            `;

            const trainingId = rows[0].id;
            const candidateIds = Array.isArray(input.candidate_ids)
                ? input.candidate_ids
                : [];

            for (const candidateId of candidateIds) {
                await sql`
                    INSERT INTO training_participants (
                        training_id,
                        candidate_id
                    )
                    VALUES (
                        ${trainingId},
                        ${Number(candidateId)}
                    )
                    ON CONFLICT DO NOTHING
                `;
            }

            await writeLog(
                sql,
                user,
                "Eğitim oluşturuldu",
                "Eğitim",
                trainingId
            );

            return send(res, 201, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "training" && method === "GET") {
            if (!requireUser(user, res, "trainings.read")) {
                return;
            }

            const id = Number(req.query?.id);

            const training = (
                await sql`
                    SELECT
                        tr.*,
                        a.name AS trainer_name
                    FROM trainings tr
                    LEFT JOIN admins a
                        ON a.id = tr.trainer_admin_id
                    WHERE tr.id = ${id}
                `
            )[0];

            if (!training) {
                return send(res, 404, {
                    ok: false,
                    error: "Eğitim bulunamadı."
                });
            }

            if (
                user.role === "trainer" &&
                Number(training.trainer_admin_id) !== Number(user.id)
            ) {
                return send(res, 403, {
                    ok: false,
                    error: "Bu eğitime erişemezsiniz."
                });
            }

            const participants = await sql`
                SELECT
                    tp.*,
                    c.telegram,
                    c.name,
                    c.nda_status,
                    c.status
                FROM training_participants tp
                JOIN candidates c
                    ON c.id = tp.candidate_id
                WHERE tp.training_id = ${id}
                ORDER BY c.name NULLS LAST, c.telegram
            `;

            const available = await sql`
                SELECT
                    c.id,
                    c.telegram,
                    c.name,
                    c.nda_status,
                    c.status
                FROM candidates c
                WHERE
                    c.archived = false
                    AND NOT EXISTS (
                        SELECT 1
                        FROM training_participants tp
                        WHERE
                            tp.training_id = ${id}
                            AND tp.candidate_id = c.id
                    )
                ORDER BY c.updated_at DESC
                LIMIT 500
            `;

            return send(res, 200, {
                ok: true,
                item: training,
                participants,
                available
            });
        }

        if (action === "training-participant" && method === "POST") {
            if (!requireUser(user, res, "trainings.write")) {
                return;
            }

            const input = parseBody(req);
            const trainingId = Number(input.training_id);
            const candidateId = Number(input.candidate_id);

            const rows = await sql`
                INSERT INTO training_participants (
                    training_id,
                    candidate_id
                )
                VALUES (
                    ${trainingId},
                    ${candidateId}
                )
                ON CONFLICT (
                    training_id,
                    candidate_id
                )
                DO NOTHING
                RETURNING *
            `;

            await writeLog(
                sql,
                user,
                "Menejer eğitime eklendi",
                "Eğitim",
                trainingId
            );

            return send(res, 200, {
                ok: true,
                item: rows[0] || null
            });
        }

        if (action === "training-participant" && method === "PATCH") {
            if (!requireUser(user, res, "trainings.update")) {
                return;
            }

            const input = parseBody(req);
            const id = Number(input.id);

            const current = (
                await sql`
                    SELECT
                        tp.*,
                        tr.trainer_admin_id
                    FROM training_participants tp
                    JOIN trainings tr
                        ON tr.id = tp.training_id
                    WHERE tp.id = ${id}
                `
            )[0];

            if (!current) {
                return send(res, 404, {
                    ok: false,
                    error: "Katılımcı bulunamadı."
                });
            }

            if (
                user.role === "trainer" &&
                Number(current.trainer_admin_id) !== Number(user.id)
            ) {
                return send(res, 403, {
                    ok: false,
                    error: "Bu eğitimi güncelleme yetkiniz yok."
                });
            }

            const rows = await sql`
                UPDATE training_participants
                SET
                    attendance = ${
                        input.attendance || current.attendance
                    },
                    outcome = ${
                        input.outcome || current.outcome
                    },
                    trainer_note = ${
                        input.trainer_note !== undefined
                            ? String(input.trainer_note)
                            : current.trainer_note
                    }
                WHERE id = ${id}
                RETURNING *
            `;

            return send(res, 200, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "training-participant" && method === "DELETE") {
            if (!requireUser(user, res, "trainings.write")) {
                return;
            }

            const input = parseBody(req);
            const id = Number(input.id);

            const removed = await sql`
                DELETE FROM training_participants
                WHERE id = ${id}
                RETURNING training_id
            `;

            if (!removed.length) {
                return send(res, 404, {
                    ok: false,
                    error: "Katılımcı bulunamadı."
                });
            }

            await writeLog(
                sql,
                user,
                "Menejer eğitimden çıkarıldı",
                "Eğitim",
                removed[0].training_id
            );

            return send(res, 200, {
                ok: true
            });
        }

        if (action === "training" && method === "DELETE") {
            if (!requireUser(user, res, "trainings.write")) {
                return;
            }

            const input = parseBody(req);
            const id = Number(input.id || req.query?.id);

            const removed = await sql`
                DELETE FROM trainings
                WHERE id = ${id}
                RETURNING id
            `;

            if (!removed.length) {
                return send(res, 404, {
                    ok: false,
                    error: "Eğitim bulunamadı."
                });
            }

            await writeLog(
                sql,
                user,
                "Eğitim silindi",
                "Eğitim",
                id
            );

            return send(res, 200, {
                ok: true
            });
        }

        if (action === "stale" && method === "GET") {
            if (!requireUser(user, res, "managers.read")) {
                return;
            }

            const days = Math.max(
                1,
                Math.min(
                    365,
                    Number(req.query?.days || 30)
                )
            );

            const rows = await sql`
                SELECT
                    c.*,
                    t.name AS team_name
                FROM candidates c
                LEFT JOIN teams t
                    ON t.id = c.team_id
                WHERE
                    c.archived = false
                    AND COALESCE(
                        c.last_contact_at,
                        c.created_at
                    ) < NOW() - (${days} * INTERVAL '1 day')
                ORDER BY COALESCE(
                    c.last_contact_at,
                    c.created_at
                ) ASC
                LIMIT 500
            `;

            return send(res, 200, {
                ok: true,
                items: rows,
                days
            });
        }

        if (action === "admins" && method === "GET") {
            if (!requireUser(user, res, "admins.read")) {
                return;
            }

            const rows = await sql`
                SELECT
                    id,
                    username,
                    name,
                    role,
                    permissions,
                    active,
                    created_at,
                    updated_at
                FROM admins
                ORDER BY
                    CASE
                        WHEN LOWER(username) = 'okancoach' THEN 0
                        ELSE 1
                    END,
                    created_at DESC
            `;

            return send(res, 200, {
                ok: true,
                items: rows
            });
        }

        if (action === "admins" && method === "POST") {
            if (!requireUser(user, res, "admins.write")) {
                return;
            }

            const input = parseBody(req);
            const username = String(input.username || "").trim();
            const password = String(input.password || "");
            const role = String(input.role || "hr_admin");

            if (!username || password.length < 8) {
                return send(res, 400, {
                    ok: false,
                    error:
                        "Kullanıcı adı zorunludur ve şifre en az 8 karakter olmalıdır."
                });
            }

            if (
                ![
                    "hr_admin",
                    "trainer",
                    "super_admin"
                ].includes(role)
            ) {
                return send(res, 400, {
                    ok: false,
                    error: "Geçersiz yönetici rolü."
                });
            }

            const hash = await bcrypt.hash(password, 12);

            const permissions =
                input.permissions &&
                typeof input.permissions === "object"
                    ? input.permissions
                    : {};

            const rows = await sql`
                INSERT INTO admins (
                    username,
                    name,
                    password_hash,
                    role,
                    permissions
                )
                VALUES (
                    ${username},
                    ${String(input.name || username).trim()},
                    ${hash},
                    ${role},
                    ${JSON.stringify(permissions)}::jsonb
                )
                RETURNING
                    id,
                    username,
                    name,
                    role,
                    permissions,
                    active
            `;

            await writeLog(
                sql,
                user,
                "Yönetici hesabı oluşturuldu",
                "Yönetici",
                rows[0].id
            );

            return send(res, 201, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "admin" && method === "PATCH") {
            if (!requireUser(user, res, "admins.write")) {
                return;
            }

            const input = parseBody(req);
            const id = Number(input.id);

            const current = (
                await sql`
                    SELECT *
                    FROM admins
                    WHERE id = ${id}
                    LIMIT 1
                `
            )[0];

            if (!current) {
                return send(res, 404, {
                    ok: false,
                    error: "Yönetici bulunamadı."
                });
            }

            if (
                current.username.toLowerCase() === "okancoach" &&
                input.active === false
            ) {
                return send(res, 403, {
                    ok: false,
                    error: "Ana Süper Yönetici devre dışı bırakılamaz."
                });
            }

            let passwordHash = current.password_hash;

            if (input.password) {
                if (String(input.password).length < 8) {
                    return send(res, 400, {
                        ok: false,
                        error: "Şifre en az 8 karakter olmalıdır."
                    });
                }

                passwordHash = await bcrypt.hash(
                    String(input.password),
                    12
                );
            }

            const role =
                current.username.toLowerCase() === "okancoach"
                    ? "super_admin"
                    : String(input.role || current.role);

            const permissions =
                input.permissions &&
                typeof input.permissions === "object"
                    ? input.permissions
                    : current.permissions;

            const rows = await sql`
                UPDATE admins
                SET
                    name = ${
                        input.name !== undefined
                            ? String(input.name).trim()
                            : current.name
                    },
                    role = ${role},
                    permissions = ${JSON.stringify(permissions)}::jsonb,
                    active = ${
                        input.active !== undefined
                            ? Boolean(input.active)
                            : current.active
                    },
                    password_hash = ${passwordHash},
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING
                    id,
                    username,
                    name,
                    role,
                    permissions,
                    active,
                    updated_at
            `;

            await writeLog(
                sql,
                user,
                "Yönetici hesabı güncellendi",
                "Yönetici",
                id
            );

            return send(res, 200, {
                ok: true,
                item: rows[0]
            });
        }

        if (action === "admin" && method === "DELETE") {
            if (!requireUser(user, res, "admins.delete")) {
                return;
            }

            const input = parseBody(req);
            const id = Number(input.id || req.query?.id);

            const current = (
                await sql`
                    SELECT *
                    FROM admins
                    WHERE id = ${id}
                    LIMIT 1
                `
            )[0];

            if (!current) {
                return send(res, 404, {
                    ok: false,
                    error: "Yönetici bulunamadı."
                });
            }

            if (current.username.toLowerCase() === "okancoach") {
                return send(res, 403, {
                    ok: false,
                    error: "Ana Süper Yönetici silinemez."
                });
            }

            if (Number(current.id) === Number(user.id)) {
                return send(res, 403, {
                    ok: false,
                    error: "Kendi hesabınızı silemezsiniz."
                });
            }

            await sql`
                UPDATE trainings
                SET trainer_admin_id = NULL
                WHERE trainer_admin_id = ${id}
            `;

            await sql`
                UPDATE candidate_notes
                SET author_admin_id = NULL
                WHERE author_admin_id = ${id}
            `;

            await sql`
                UPDATE audit_logs
                SET admin_id = NULL
                WHERE admin_id = ${id}
            `;

            await sql`
                DELETE FROM admins
                WHERE id = ${id}
            `;

            await writeLog(
                sql,
                user,
                "Yönetici hesabı silindi",
                "Yönetici",
                id
            );

            return send(res, 200, {
                ok: true
            });
        }

        if (action === "logs" && method === "GET") {
            if (!requireUser(user, res, "audit.read")) {
                return;
            }

            const rows = await sql`
                SELECT
                    l.*,
                    a.username,
                    a.name AS admin_name
                FROM audit_logs l
                LEFT JOIN admins a
                    ON a.id = l.admin_id
                ORDER BY l.created_at DESC
                LIMIT 500
            `;

            return send(res, 200, {
                ok: true,
                items: rows
            });
        }

        return send(res, 404, {
            ok: false,
            error: "İstenen işlem bulunamadı."
        });
    } catch (error) {
        console.error(error);

        return send(res, 500, {
            ok: false,
            error:
                error?.message ||
                "Sunucu hatası oluştu."
        });
    }
}
