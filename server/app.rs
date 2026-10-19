use argon2::{
    Argon2, PasswordHasher, PasswordVerifier,
    password_hash::{PasswordHash, SaltString, rand_core::OsRng},
};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row, postgres::PgPoolOptions};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
struct App {
    db: PgPool,
    http: reqwest::Client,
}
#[derive(Debug)]
struct Failure(StatusCode, String, Option<Value>);
impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"error":self.1,"current":self.2}))).into_response()
    }
}
impl From<sqlx::Error> for Failure {
    fn from(e: sqlx::Error) -> Self {
        eprintln!(
            "database operation failed: {}",
            e.as_database_error()
                .map(|e| e.code().unwrap_or_default().into_owned())
                .unwrap_or_else(|| "connection".into())
        );
        Self(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The account could not be updated. Please try again.".into(),
            None,
        )
    }
}
type Result<T> = std::result::Result<T, Failure>;
fn bad(s: &str) -> Failure {
    Failure(StatusCode::BAD_REQUEST, s.into(), None)
}
fn denied() -> Failure {
    Failure(
        StatusCode::FORBIDDEN,
        "This account or device no longer has access to this household.".into(),
        None,
    )
}
fn text<'a>(v: &'a Value, k: &str) -> Result<&'a str> {
    v[k].as_str()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| bad(&format!("Missing {k}.")))
}
fn uuid(v: &Value, k: &str) -> Result<Uuid> {
    Uuid::parse_str(text(v, k)?).map_err(|_| bad("Invalid record identifier."))
}
fn hash(s: &str) -> String {
    format!("{:x}", Sha256::digest(s.as_bytes()))
}
fn stamp() -> String {
    Utc::now().to_rfc3339()
}
#[derive(Clone)]
struct Identity {
    id: Uuid,
    email: String,
    name: String,
    kiosk: Option<Uuid>,
    revoked: bool,
}
#[derive(Deserialize)]
struct Command {
    action: String,
    #[serde(default)]
    payload: Value,
}

pub async fn router() -> std::result::Result<Router, Box<dyn std::error::Error + Send + Sync>> {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or("postgres://wag:wag_local_only@127.0.0.1:54329/wag".into());
    let db = PgPoolOptions::new()
        .max_connections(3)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect_lazy_with(
            url.parse::<sqlx::postgres::PgConnectOptions>()?
                .statement_cache_capacity(0),
        );
    let app = Arc::new(App {
        db,
        http: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?,
    });
    Ok(Router::new()
        .route(
            "/api/app",
            get(|| async { Json(json!({"ok":true,"service":"Wag Journal","version":"0.1.0"})) })
                .post(handle),
        )
        .layer(DefaultBodyLimit::max(256 * 1024))
        .with_state(app))
}
async fn identity(app: &App, h: &HeaderMap) -> Result<Identity> {
    let token = h
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or(Failure(
            StatusCode::UNAUTHORIZED,
            "Please sign in to continue.".into(),
            None,
        ))?;
    if token.starts_with("kiosk_") {
        let row =
            sqlx::query("select id,household_id,name,revoked_at from devices where token_hash=$1")
                .persistent(false)
                .bind(hash(token))
                .fetch_optional(&app.db)
                .await?
                .ok_or_else(denied)?;
        return Ok(Identity {
            id: row.get("id"),
            email: String::new(),
            name: row.get("name"),
            kiosk: Some(row.get("household_id")),
            revoked: row.get::<Option<DateTime<Utc>>, _>("revoked_at").is_some(),
        });
    }
    let user: Value = if std::env::var("LOCAL_DEV_AUTH").as_deref() == Ok("true")
        && std::env::var("VERCEL").is_err()
        && token.starts_with("local:")
    {
        let id = Uuid::parse_str(&token[6..]).map_err(|_| denied())?;
        json!({"id":id,"email":format!("{id}@local.test"),"email_confirmed_at":stamp(),"user_metadata":{"name":"Local caregiver"}})
    } else {
        let url = std::env::var("SUPABASE_URL").map_err(|_| {
            Failure(
                StatusCode::SERVICE_UNAVAILABLE,
                "Account services are not connected yet.".into(),
                None,
            )
        })?;
        let key = std::env::var("SUPABASE_ANON_KEY")
            .map_err(|_| bad("Account services are not configured."))?;
        let response = app
            .http
            .get(format!("{url}/auth/v1/user"))
            .header("apikey", key)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|_| {
                Failure(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "Sign-in could not be checked. Try again when connected.".into(),
                    None,
                )
            })?;
        if !response.status().is_success() {
            return Err(Failure(
                StatusCode::UNAUTHORIZED,
                "Please sign in again.".into(),
                None,
            ));
        }
        response.json().await.map_err(|_| denied())?
    };
    if user["email_confirmed_at"].is_null() {
        return Err(Failure(
            StatusCode::UNAUTHORIZED,
            "Check your email to confirm your account first.".into(),
            None,
        ));
    }
    let id = uuid(&user, "id")?;
    let email = text(&user, "email")?.to_lowercase();
    let name = user["user_metadata"]["name"]
        .as_str()
        .filter(|s| !s.is_empty())
        .unwrap_or("Caregiver")
        .chars()
        .take(80)
        .collect::<String>();
    sqlx::query("insert into profiles(id,email,name) values($1,$2,$3) on conflict(id) do update set email=excluded.email,name=excluded.name").persistent(false).bind(id).bind(&email).bind(&name).execute(&app.db).await?;
    Ok(Identity {
        id,
        email,
        name,
        kiosk: None,
        revoked: false,
    })
}
async fn access(
    app: &App,
    u: &Identity,
    h: Uuid,
    owner: bool,
    allow_deleted: bool,
) -> Result<Value> {
    if u.revoked {
        return Err(denied());
    }
    let row = sqlx::query("select data,owner_id,deletion_at from households where id=$1")
        .persistent(false)
        .bind(h)
        .fetch_optional(&app.db)
        .await?
        .ok_or_else(denied)?;
    if !allow_deleted && row.get::<Option<DateTime<Utc>>, _>("deletion_at").is_some() {
        return Err(Failure(
            StatusCode::LOCKED,
            "This household is pending deletion.".into(),
            None,
        ));
    }
    if let Some(k) = u.kiosk {
        if k != h || owner {
            return Err(denied());
        }
    } else {
        let member =
            sqlx::query("select role from memberships where household_id=$1 and user_id=$2")
                .persistent(false)
                .bind(h)
                .bind(u.id)
                .fetch_optional(&app.db)
                .await?;
        if member.is_none() || owner && row.get::<Uuid, _>("owner_id") != u.id {
            return Err(denied());
        }
    }
    Ok(row.get("data"))
}
async fn handle(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Json(c): Json<Command>,
) -> Result<Json<Value>> {
    let u = identity(&app, &headers).await?;
    if u.revoked && c.action != "quarantine" {
        return Err(denied());
    }
    let p = &c.payload;
    let value = match c.action.as_str() {
        "snapshot" => snapshot(&app, &u, p["all"].as_bool().unwrap_or(false)).await?,
        "createHousehold" => {
            if u.kiosk.is_some() {
                return Err(denied());
            }
            let id = uuid(p, "id")?;
            let puppy = text(p, "puppy")?;
            let timezone = text(p, "timezone")?;
            if puppy.len() > 100 || timezone.len() > 100 {
                return Err(bad("Keep names under 100 characters."));
            }
            let valid: bool =
                sqlx::query_scalar("select exists(select 1 from pg_timezone_names where name=$1)")
                    .persistent(false)
                    .bind(timezone)
                    .fetch_one(&app.db)
                    .await?;
            if !valid {
                return Err(bad("Choose a valid timezone."));
            }
            let birth = text(p, "birthDate")?;
            chrono::NaiveDate::parse_from_str(birth, "%Y-%m-%d")
                .map_err(|_| bad("Enter a valid birth date."))?;
            let mut tx = app.db.begin().await?;
            let count: i64 =
                sqlx::query_scalar("select count(*) from households where owner_id=$1")
                    .persistent(false)
                    .bind(u.id)
                    .fetch_one(&mut *tx)
                    .await?;
            if count >= 10 {
                return Err(bad("This account has reached its household limit."));
            }
            let data = json!({"id":id,"name":p["name"].as_str().unwrap_or("Our household"),"puppy":puppy,"birthDate":birth,"timezone":timezone,"ownerId":u.id,"version":1});
            sqlx::query("insert into households(id,owner_id,data) values($1,$2,$3) on conflict(id) do nothing").persistent(false).bind(id).bind(u.id).bind(&data).execute(&mut *tx).await?;
            let owner: Uuid = sqlx::query_scalar("select owner_id from households where id=$1")
                .persistent(false)
                .bind(id)
                .fetch_one(&mut *tx)
                .await?;
            if owner != u.id {
                return Err(denied());
            }
            sqlx::query("insert into memberships values($1,$2,'owner') on conflict do nothing")
                .persistent(false)
                .bind(id)
                .bind(u.id)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            data
        }
        "mutate" => mutate(&app, &u, p).await?,
        "invite" => {
            let h = uuid(p, "householdId")?;
            access(&app, &u, h, true, false).await?;
            let email = text(p, "email")?.trim().to_lowercase();
            if !email.contains('@') || email.len() > 254 {
                return Err(bad("Enter a valid email address."));
            }
            let mut tx = app.db.begin().await?;
            sqlx::query("select id from households where id=$1 for update")
                .persistent(false)
                .bind(h)
                .execute(&mut *tx)
                .await?;
            let count:i64=sqlx::query_scalar("select (select count(*) from memberships where household_id=$1)+(select count(*) from invitations where household_id=$1 and accepted_at is null and expires_at>now())").persistent(false).bind(h).fetch_one(&mut *tx).await?;
            if count >= 10 {
                return Err(bad(
                    "This household has reached its caregiver or invitation limit.",
                ));
            }
            let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
            sqlx::query(
                "insert into invitations(id,household_id,email,token_hash) values($1,$2,$3,$4)",
            )
            .persistent(false)
            .bind(Uuid::new_v4())
            .bind(h)
            .bind(email)
            .bind(hash(&token))
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            json!({"token":token})
        }
        "acceptInvite" => {
            if u.kiosk.is_some() {
                return Err(denied());
            }
            let mut tx = app.db.begin().await?;
            let row=sqlx::query("select id,household_id from invitations where token_hash=$1 and email=$2 and accepted_at is null and expires_at>now() for update").persistent(false).bind(hash(text(p,"token")?)).bind(&u.email).fetch_optional(&mut *tx).await?.ok_or_else(||bad("This invitation has expired, was used, or is for another email address."))?;
            let h: Uuid = row.get("household_id");
            sqlx::query("select id from households where id=$1 and deletion_at is null for update")
                .persistent(false)
                .bind(h)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or_else(denied)?;
            let count: i64 =
                sqlx::query_scalar("select count(*) from memberships where household_id=$1")
                    .persistent(false)
                    .bind(h)
                    .fetch_one(&mut *tx)
                    .await?;
            if count >= 10 {
                return Err(bad("The household is full."));
            }
            sqlx::query("insert into memberships values($1,$2,'caregiver') on conflict do nothing")
                .persistent(false)
                .bind(h)
                .bind(u.id)
                .execute(&mut *tx)
                .await?;
            sqlx::query("update invitations set accepted_at=now() where id=$1")
                .persistent(false)
                .bind(row.get::<Uuid, _>("id"))
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            json!({"householdId":h})
        }
        "removeMember" => {
            let h = uuid(p, "householdId")?;
            let target = uuid(p, "userId")?;
            access(&app, &u, h, true, false).await?;
            if target == u.id {
                return Err(bad("Transfer ownership before leaving."));
            }
            sqlx::query("insert into former_memberships(household_id,user_id) values($1,$2) on conflict(household_id,user_id) do update set removed_at=now()").persistent(false).bind(h).bind(target).execute(&app.db).await?;
            sqlx::query("delete from memberships where household_id=$1 and user_id=$2")
                .persistent(false)
                .bind(h)
                .bind(target)
                .execute(&app.db)
                .await?;
            sqlx::query("delete from push_subscriptions where household_id=$1 and user_id=$2")
                .persistent(false)
                .bind(h)
                .bind(target)
                .execute(&app.db)
                .await?;
            json!({"ok":true})
        }
        "transfer" => {
            let h = uuid(p, "householdId")?;
            access(&app, &u, h, true, false).await?;
            let target = uuid(p, "userId")?;
            if target == u.id {
                return Err(bad("Choose another caregiver."));
            }
            let member: bool = sqlx::query_scalar(
                "select exists(select 1 from memberships where household_id=$1 and user_id=$2)",
            )
            .persistent(false)
            .bind(h)
            .bind(target)
            .fetch_one(&app.db)
            .await?;
            if !member {
                return Err(denied());
            }
            sqlx::query("insert into transfers(household_id,to_user) values($1,$2) on conflict(household_id) do update set to_user=excluded.to_user,created_at=now()").persistent(false).bind(h).bind(target).execute(&app.db).await?;
            json!({"ok":true})
        }
        "acceptTransfer" => {
            let h = uuid(p, "householdId")?;
            access(&app, &u, h, false, false).await?;
            if u.kiosk.is_some() {
                return Err(denied());
            }
            let mut tx = app.db.begin().await?;
            let exists = sqlx::query(
                "delete from transfers where household_id=$1 and to_user=$2 returning household_id",
            )
            .persistent(false)
            .bind(h)
            .bind(u.id)
            .fetch_optional(&mut *tx)
            .await?;
            if exists.is_none() {
                return Err(bad("There is no ownership transfer for you."));
            }
            sqlx::query("update memberships set role=case when user_id=$2 then 'owner' else 'caregiver' end where household_id=$1").persistent(false).bind(h).bind(u.id).execute(&mut *tx).await?;
            sqlx::query("update households set owner_id=$2,data=jsonb_set(data,'{ownerId}',to_jsonb($2::text)),version=version+1 where id=$1").persistent(false).bind(h).bind(u.id).execute(&mut *tx).await?;
            tx.commit().await?;
            json!({"ok":true})
        }
        "deleteHousehold" | "cancelDeletion" => {
            let h = uuid(p, "householdId")?;
            access(&app, &u, h, true, true).await?;
            let deleting = c.action == "deleteHousehold";
            sqlx::query("update households set deletion_at=case when $2 then coalesce(deletion_at,now()) else null end where id=$1 and (deletion_at is null or deletion_at>now()-interval '7 days')").persistent(false).bind(h).bind(deleting).execute(&app.db).await?;
            json!({"ok":true})
        }
        "pairKiosk" => {
            let h = uuid(p, "householdId")?;
            access(&app, &u, h, true, false).await?;
            let pin = text(p, "pin")?;
            if pin.len() != 6 || !pin.chars().all(|c| c.is_ascii_digit()) {
                return Err(bad("Use a six-digit PIN."));
            }
            let mut tx = app.db.begin().await?;
            sqlx::query("select id from households where id=$1 for update")
                .persistent(false)
                .bind(h)
                .execute(&mut *tx)
                .await?;
            let count: i64 = sqlx::query_scalar(
                "select count(*) from devices where household_id=$1 and revoked_at is null",
            )
            .persistent(false)
            .bind(h)
            .fetch_one(&mut *tx)
            .await?;
            if count >= 3 {
                return Err(bad("This household already has three kiosks."));
            }
            let token = format!(
                "kiosk_{}{}",
                Uuid::new_v4().simple(),
                Uuid::new_v4().simple()
            );
            let salt = SaltString::generate(&mut OsRng);
            let pin_hash = Argon2::default()
                .hash_password(pin.as_bytes(), &salt)
                .map_err(|_| bad("Could not protect the PIN."))?
                .to_string();
            let id = Uuid::new_v4();
            sqlx::query("insert into devices(id,household_id,name,token_hash,pin_hash) values($1,$2,$3,$4,$5)").persistent(false).bind(id).bind(h).bind(text(p,"name")?).bind(hash(&token)).bind(pin_hash).execute(&mut *tx).await?;
            tx.commit().await?;
            json!({"token":token,"id":id,"householdId":h,"name":p["name"]})
        }
        "unlockKiosk" => {
            if u.kiosk.is_none() {
                return Err(denied());
            }
            let mut tx = app.db.begin().await?;
            let row = sqlx::query(
                "select pin_hash,attempts,locked_until from devices where id=$1 for update",
            )
            .persistent(false)
            .bind(u.id)
            .fetch_one(&mut *tx)
            .await?;
            if row
                .get::<Option<DateTime<Utc>>, _>("locked_until")
                .is_some_and(|t| t > Utc::now())
            {
                return Err(Failure(
                    StatusCode::TOO_MANY_REQUESTS,
                    "Too many attempts. Try again in 15 minutes.".into(),
                    None,
                ));
            }
            let stored: String = row.get("pin_hash");
            let valid = PasswordHash::new(&stored).ok().is_some_and(|h| {
                Argon2::default()
                    .verify_password(p["pin"].as_str().unwrap_or("").as_bytes(), &h)
                    .is_ok()
            });
            if !valid {
                sqlx::query("update devices set attempts=attempts+1,locked_until=case when attempts+1>=5 then now()+interval '15 minutes' else null end where id=$1").persistent(false).bind(u.id).execute(&mut *tx).await?;
                tx.commit().await?;
                return Err(bad(
                    "That PIN did not match. Try again or ask the owner to reset it.",
                ));
            }
            sqlx::query("update devices set attempts=0,locked_until=null where id=$1")
                .persistent(false)
                .bind(u.id)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            json!({"ok":true,"requiresPersonalSignIn":true})
        }
        "revokeKiosk" | "resetPin" => {
            let id = uuid(p, "deviceId")?;
            let h: Uuid = sqlx::query_scalar("select household_id from devices where id=$1")
                .persistent(false)
                .bind(id)
                .fetch_optional(&app.db)
                .await?
                .ok_or_else(denied)?;
            access(&app, &u, h, true, false).await?;
            if c.action == "revokeKiosk" {
                sqlx::query("update devices set revoked_at=now() where id=$1")
                    .persistent(false)
                    .bind(id)
                    .execute(&app.db)
                    .await?;
            } else {
                let pin = text(p, "pin")?;
                if pin.len() != 6 || !pin.chars().all(|c| c.is_ascii_digit()) {
                    return Err(bad("Use a six-digit PIN."));
                }
                let salt = SaltString::generate(&mut OsRng);
                let ph = Argon2::default()
                    .hash_password(pin.as_bytes(), &salt)
                    .map_err(|_| bad("Could not reset PIN."))?
                    .to_string();
                sqlx::query(
                    "update devices set pin_hash=$2,attempts=0,locked_until=null where id=$1",
                )
                .persistent(false)
                .bind(id)
                .bind(ph)
                .execute(&app.db)
                .await?;
            }
            json!({"ok":true})
        }
        "deleteAccount" => {
            if u.kiosk.is_some() {
                return Err(denied());
            }
            let count: i64 =
                sqlx::query_scalar("select count(*) from households where owner_id=$1")
                    .persistent(false)
                    .bind(u.id)
                    .fetch_one(&app.db)
                    .await?;
            if count > 0 {
                return Err(bad(
                    "Transfer ownership or finish deleting every owned household before deleting your account.",
                ));
            }
            let service=std::env::var("SUPABASE_SERVICE_ROLE_KEY").map_err(|_|Failure(StatusCode::SERVICE_UNAVAILABLE,"Account deletion needs the operator to connect the account administration service.".into(),None))?;
            let url = std::env::var("SUPABASE_URL")
                .map_err(|_| bad("Account services are unavailable."))?;
            sqlx::query("insert into account_deletions(user_id) values($1) on conflict do nothing")
                .persistent(false)
                .bind(u.id)
                .execute(&app.db)
                .await?;
            let response = app
                .http
                .delete(format!("{url}/auth/v1/admin/users/{}", u.id))
                .header("apikey", &service)
                .bearer_auth(&service)
                .send()
                .await
                .map_err(|_| {
                    bad("Account deletion could not reach the account service. Try again.")
                })?;
            if !response.status().is_success() {
                return Err(bad(
                    "The account service did not confirm deletion. Contact the operator.",
                ));
            }
            sqlx::query("update account_deletions set auth_deleted=true where user_id=$1")
                .persistent(false)
                .bind(u.id)
                .execute(&app.db)
                .await?;
            sqlx::query("select anonymise_wag_account($1)")
                .persistent(false)
                .bind(u.id)
                .execute(&app.db)
                .await?;
            json!({"ok":true})
        }
        "leaveHousehold" => {
            let h = uuid(p, "householdId")?;
            let data = access(&app, &u, h, false, false).await?;
            if u.kiosk.is_some() || data["ownerId"] == json!(u.id) {
                return Err(bad(
                    "The owner must transfer ownership or delete the household before leaving.",
                ));
            }
            sqlx::query("delete from push_subscriptions where household_id=$1 and user_id=$2")
                .persistent(false)
                .bind(h)
                .bind(u.id)
                .execute(&app.db)
                .await?;
            sqlx::query("delete from memberships where household_id=$1 and user_id=$2")
                .persistent(false)
                .bind(h)
                .bind(u.id)
                .execute(&app.db)
                .await?;
            json!({"ok":true})
        }
        "quarantineList" => {
            let h = uuid(p, "householdId")?;
            access(&app, &u, h, true, false).await?;
            let rows=sqlx::query("select q.id,q.payload,q.created_at,coalesce(d.name,p.name,'Former caregiver') as name from quarantined_changes q left join devices d on d.id=q.device_id left join profiles p on p.id=q.user_id where q.household_id=$1 order by q.created_at").persistent(false).bind(h).fetch_all(&app.db).await?;
            json!(rows.into_iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"changes":r.get::<Value,_>("payload"),"device":r.get::<Option<String>,_>("name"),"at":r.get::<DateTime<Utc>,_>("created_at").to_rfc3339()})).collect::<Vec<_>>())
        }
        "quarantineDiscard" => {
            let h = uuid(p, "householdId")?;
            access(&app, &u, h, true, false).await?;
            sqlx::query("delete from quarantined_changes where id=$1 and household_id=$2")
                .persistent(false)
                .bind(uuid(p, "id")?)
                .bind(h)
                .execute(&app.db)
                .await?;
            json!({"ok":true})
        }
        "subscribe" => {
            let h = uuid(p, "householdId")?;
            access(&app, &u, h, false, false).await?;
            if u.kiosk.is_some() {
                return Err(denied());
            }
            let subscription = &p["subscription"];
            let endpoint = text(subscription, "endpoint")?;
            let url =
                reqwest::Url::parse(endpoint).map_err(|_| bad("Invalid notification endpoint."))?;
            let host = url.host_str().unwrap_or("");
            if url.scheme() != "https"
                || !(host == "fcm.googleapis.com"
                    || host.ends_with(".push.services.mozilla.com")
                    || host == "updates.push.services.mozilla.com"
                    || host.ends_with(".push.apple.com")
                    || host == "web.push.apple.com"
                    || host.ends_with(".notify.windows.com"))
            {
                return Err(bad("This notification provider is not supported yet."));
            }
            sqlx::query("insert into push_subscriptions(id,household_id,user_id,endpoint,subscription) values($1,$2,$3,$4,$5) on conflict(endpoint) do update set household_id=excluded.household_id,user_id=excluded.user_id,subscription=excluded.subscription").persistent(false).bind(Uuid::new_v4()).bind(h).bind(u.id).bind(endpoint).bind(subscription).execute(&app.db).await?;
            json!({"ok":true})
        }
        "quarantine" => {
            let (h, device, user) = if let Some(h) = u.kiosk {
                if !u.revoked {
                    return Err(bad("This device is still active. Sync normally."));
                }
                (h, Some(u.id), None)
            } else {
                let h = uuid(p, "householdId")?;
                let former:bool=sqlx::query_scalar("select exists(select 1 from former_memberships where household_id=$1 and user_id=$2) and not exists(select 1 from memberships where household_id=$1 and user_id=$2)").persistent(false).bind(h).bind(u.id).fetch_one(&app.db).await?;
                if !former {
                    return Err(denied());
                }
                (h, None, Some(u.id))
            };
            let id = uuid(p, "id")?;
            let changes = p["changes"]
                .as_array()
                .ok_or_else(|| bad("Invalid recovery batch."))?;
            if changes.len() > 100 {
                return Err(bad("Recover at most 100 changes per batch."));
            }
            sqlx::query("insert into quarantined_changes(id,household_id,device_id,user_id,payload) values($1,$2,$3,$4,$5) on conflict(id) do nothing").persistent(false).bind(id).bind(h).bind(device).bind(user).bind(&p["changes"]).execute(&app.db).await?;
            json!({"ok":true})
        }
        _ => return Err(bad("This action is not available.")),
    };
    Ok(Json(value))
}
async fn snapshot(app: &App, u: &Identity, all: bool) -> Result<Value> {
    if u.revoked {
        return Err(denied());
    }
    let hs = if let Some(h) = u.kiosk {
        sqlx::query(
            "select id,data,deletion_at from households where id=$1 and deletion_at is null",
        )
        .persistent(false)
        .bind(h)
        .fetch_all(&app.db)
        .await?
    } else {
        sqlx::query("select h.id,h.data,h.deletion_at from households h join memberships m on m.household_id=h.id where m.user_id=$1").persistent(false).bind(u.id).fetch_all(&app.db).await?
    };
    let mut result = json!({"households":[],"members":[],"events":[],"routines":[],"checks":[],"constraints":[],"preferences":[],"devices":[],"history":[],"transfers":[]});
    for h in hs {
        let id: Uuid = h.get("id");
        let mut data: Value = h.get("data");
        let deleting: Option<DateTime<Utc>> = h.get("deletion_at");
        if let Some(d) = deleting {
            data["deletionAt"] = json!(d.to_rfc3339());
        }
        result["households"]
            .as_array_mut()
            .unwrap()
            .push(data.clone());
        if deleting.is_some() {
            continue;
        }
        let rows=sqlx::query("select kind,data,actor_id from records where household_id=$1 and (deleted_at is null or deleted_at>now()-interval '30 days') order by updated_at").persistent(false).bind(id).fetch_all(&app.db).await?;
        for row in rows {
            let kind: String = row.get("kind");
            let mut d: Value = row.get("data");
            if kind == "preference"
                && (u.kiosk.is_some() || row.get::<Option<Uuid>, _>("actor_id") != Some(u.id))
            {
                continue;
            }
            if kind == "event" {
                let at = d["at"]
                    .as_str()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok());
                let active = d["end"].is_null()
                    && ["outside", "play", "training", "crate", "sleep"]
                        .contains(&d["type"].as_str().unwrap_or(""));
                if u.kiosk.is_some() {
                    let today:bool=sqlx::query_scalar("select ($1::timestamptz at time zone $2)::date=(now() at time zone $2)::date").persistent(false).bind(d["at"].as_str().unwrap_or("")).bind(data["timezone"].as_str().unwrap_or("UTC")).fetch_one(&app.db).await?;
                    if !today && !active {
                        continue;
                    }
                    d.as_object_mut().unwrap().remove("notes");
                } else if !all
                    && !active
                    && at.is_some_and(|a| a < Utc::now() - chrono::Duration::days(30))
                {
                    continue;
                }
            } else if u.kiosk.is_some() {
                continue;
            }
            let key = match kind.as_str() {
                "event" => "events",
                "routine" => "routines",
                "check" => "checks",
                "constraint" => "constraints",
                "preference" => "preferences",
                _ => continue,
            };
            result[key].as_array_mut().unwrap().push(d);
        }
        if u.kiosk.is_some() {
            continue;
        }
        for m in sqlx::query("select p.id,p.name,m.role from memberships m join profiles p on p.id=m.user_id where m.household_id=$1").persistent(false).bind(id).fetch_all(&app.db).await?{result["members"].as_array_mut().unwrap().push(json!({"id":m.get::<Uuid,_>("id"),"householdId":id,"name":m.get::<String,_>("name"),"role":m.get::<String,_>("role")}));}
        for r in sqlx::query("select id,kind,record_id,actor,before_data,after_data,created_at from history where household_id=$1 and created_at>now()-interval '30 days' order by created_at desc limit 250").persistent(false).bind(id).fetch_all(&app.db).await?{result["history"].as_array_mut().unwrap().push(json!({"id":r.get::<Uuid,_>("id"),"entity":r.get::<String,_>("kind"),"recordId":r.get::<Uuid,_>("record_id"),"actor":r.get::<String,_>("actor"),"before":r.get::<Option<Value>,_>("before_data"),"after":r.get::<Value,_>("after_data"),"at":r.get::<DateTime<Utc>,_>("created_at").to_rfc3339()}));}
        if data["ownerId"].as_str() == Some(&u.id.to_string()) {
            for d in sqlx::query("select id,name,revoked_at from devices where household_id=$1")
                .persistent(false)
                .bind(id)
                .fetch_all(&app.db)
                .await?
            {
                result["devices"].as_array_mut().unwrap().push(json!({"id":d.get::<Uuid,_>("id"),"name":d.get::<String,_>("name"),"householdId":id,"revokedAt":d.get::<Option<DateTime<Utc>>,_>("revoked_at").map(|d|d.to_rfc3339())}));
            }
        }
        for t in sqlx::query("select to_user from transfers where household_id=$1 and to_user=$2")
            .persistent(false)
            .bind(id)
            .bind(u.id)
            .fetch_all(&app.db)
            .await?
        {
            result["transfers"]
                .as_array_mut()
                .unwrap()
                .push(json!({"householdId":id,"userId":t.get::<Uuid,_>("to_user")}));
        }
    }
    Ok(result)
}
async fn mutate(app: &App, u: &Identity, p: &Value) -> Result<Value> {
    let operation = uuid(p, "id")?;
    let kind = text(p, "entity")?;
    let mut data = p["record"].clone();
    let id = uuid(&data, "id")?;
    let h = uuid(&data, "householdId")?;
    let expected = p["expectedVersion"]
        .as_i64()
        .ok_or_else(|| bad("A record version is required."))?;
    if !["event", "routine", "check", "constraint", "preference"].contains(&kind) {
        return Err(bad("Unknown record type."));
    }
    let hh = access(app, u, h, kind == "constraint", false).await?;
    if u.kiosk.is_some() && kind != "event" {
        return Err(denied());
    }
    let mut tx = app.db.begin().await?;
    sqlx::query("select id from households where id=$1 for update")
        .persistent(false)
        .bind(h)
        .execute(&mut *tx)
        .await?;
    // Recheck authorisation inside the household lock to close membership/revocation races.
    if let Some(k) = u.kiosk {
        let active:bool=sqlx::query_scalar("select exists(select 1 from devices where id=$1 and household_id=$2 and revoked_at is null)").persistent(false).bind(u.id).bind(k).fetch_one(&mut *tx).await?;
        if !active {
            return Err(denied());
        }
    } else {
        let active: bool = sqlx::query_scalar(
            "select exists(select 1 from memberships where household_id=$1 and user_id=$2)",
        )
        .persistent(false)
        .bind(h)
        .bind(u.id)
        .fetch_one(&mut *tx)
        .await?;
        if !active {
            return Err(denied());
        }
    }
    let digest = hash(&p.to_string());
    if let Some(receipt) =
        sqlx::query("select actor_id,request_hash,result from mutation_receipts where id=$1")
            .persistent(false)
            .bind(operation)
            .fetch_optional(&mut *tx)
            .await?
    {
        if receipt.get::<Uuid, _>("actor_id") != u.id
            || receipt.get::<String, _>("request_hash") != digest
        {
            return Err(bad("This request identifier has already been used."));
        }
        return Ok(receipt.get("result"));
    }
    let row=sqlx::query("select household_id,kind,data,version,created_at,deleted_at from records where id=$1 for update").persistent(false).bind(id).fetch_optional(&mut *tx).await?;
    let before = row.as_ref().map(|r| r.get::<Value, _>("data"));
    let version = row
        .as_ref()
        .map(|r| r.get::<i32, _>("version"))
        .unwrap_or(0);
    if let Some(r) = &row {
        if r.get::<Uuid, _>("household_id") != h || r.get::<String, _>("kind") != kind {
            return Err(denied());
        }
        if r.get::<Option<DateTime<Utc>>, _>("deleted_at")
            .is_some_and(|d| d < Utc::now() - chrono::Duration::days(30))
        {
            return Err(bad("This record is outside the recovery period."));
        }
    }
    if i64::from(version) != expected {
        return Err(Failure(
            StatusCode::CONFLICT,
            "Someone else changed this record. Review both versions before continuing.".into(),
            before,
        ));
    }
    if u.kiosk.is_some() {
        if let Some(b) = &before {
            let mut old = b.clone();
            let mut new = data.clone();
            for key in [
                "end",
                "version",
                "updatedAt",
                "actor",
                "actorId",
                "source",
                "deletedAt",
                "outcome",
            ] {
                old.as_object_mut().unwrap().remove(key);
                new.as_object_mut().unwrap().remove(key);
            }
            // Notes are redacted from kiosk reads; never overwrite them during session completion.
            new.as_object_mut().unwrap().remove("notes");
            old.as_object_mut().unwrap().remove("notes");
            if old != new {
                return Err(bad("Unlock and sign in to correct this entry."));
            }
            if !data["deletedAt"].is_null() {
                let created = row.as_ref().unwrap().get::<DateTime<Utc>, _>("created_at");
                if b["source"] != json!(u.name)
                    || created < Utc::now() - chrono::Duration::seconds(10)
                {
                    return Err(bad("Unlock and sign in to delete this entry."));
                }
            }
            if let Some(notes) = b.get("notes") {
                data["notes"] = notes.clone();
            }
        } else if !data["notes"].is_null() {
            return Err(bad("Unlock and sign in to add notes."));
        }
    }
    match kind {
        "event" => {
            let activity = text(&data, "type")?;
            if before.as_ref().is_some_and(|b| b["type"] != data["type"]) {
                return Err(bad(
                    "An existing entry cannot change activity type. Delete it and add the correct activity.",
                ));
            }
            if ![
                "outside", "potty", "meal", "play", "training", "crate", "sleep",
            ]
            .contains(&activity)
            {
                return Err(bad("Choose a valid activity."));
            }
            let start = DateTime::parse_from_rfc3339(text(&data, "at")?)
                .map_err(|_| bad("Choose a valid start time."))?;
            if start > Utc::now() + chrono::Duration::seconds(60) {
                return Err(bad(
                    "Activities cannot be in the future. Check your device clock.",
                ));
            }
            if let Some(end) = data["end"].as_str() {
                let end = DateTime::parse_from_rfc3339(end)
                    .map_err(|_| bad("Choose a valid end time."))?;
                if end < start || end > Utc::now() + chrono::Duration::seconds(60) {
                    return Err(bad(
                        "The end must follow the start and cannot be in the future.",
                    ));
                }
            }
            if activity == "potty"
                && !["wee", "poo", "both"].contains(&data["potty"].as_str().unwrap_or(""))
            {
                return Err(bad("Choose wee, poo or both."));
            }
            if let Some(m) = data.get("estimatedMinutes") {
                if !m.is_null() && !m.as_f64().is_some_and(|v| v > 0.0 && v <= 1440.0) {
                    return Err(bad("Choose an estimate between 1 and 1,440 minutes."));
                }
            }
            if data["notes"].as_str().is_some_and(|n| n.len() > 16000) {
                return Err(bad("The note is too long."));
            }
            if data["deletedAt"].is_null()
                && data["end"].is_null()
                && ["outside", "play", "training", "crate", "sleep"].contains(&activity)
            {
                let other=sqlx::query("select data from records where household_id=$1 and kind='event' and id<>$2 and deleted_at is null and data->>'type'=$3 and data->>'end' is null limit 1").persistent(false).bind(h).bind(id).bind(activity).fetch_optional(&mut *tx).await?;
                if other.is_some() {
                    return Err(Failure(
                        StatusCode::CONFLICT,
                        format!(
                            "Another {activity} session is running. End it before retrying this change."
                        ),
                        before,
                    ));
                }
            }
            for (field, target_type) in [
                ("tripId", "outside"),
                ("crateId", "crate"),
                ("previousSleepId", "sleep"),
            ] {
                if let Some(link) = data[field].as_str() {
                    let link = Uuid::parse_str(link).map_err(|_| bad("Invalid activity link."))?;
                    let linked=sqlx::query("select data from records where id=$1 and household_id=$2 and kind='event' and deleted_at is null and data->>'type'=$3").persistent(false).bind(link).bind(h).bind(target_type).fetch_optional(&mut *tx).await?.ok_or_else(||bad("The linked activity is unavailable."))?;
                    if field == "tripId" && linked.get::<Value, _>("data")["outcome"] == "no-result"
                    {
                        return Err(bad(
                            "Correct the trip's no-result outcome before linking a potty event.",
                        ));
                    }
                }
            }
            if let Some(plan) = data["planId"].as_str() {
                let parts: Vec<&str> = plan.split(':').collect();
                if parts.len() != 3 {
                    return Err(bad("Invalid planned activity link."));
                }
                let rid = Uuid::parse_str(parts[0]).map_err(|_| bad("Invalid routine link."))?;
                let plan_row=sqlx::query("select data from records where id=$1 and household_id=$2 and kind='routine' and deleted_at is null").persistent(false).bind(rid).bind(h).fetch_optional(&mut *tx).await?.ok_or_else(||bad("The linked routine is unavailable."))?;
                let plan_data: Value = plan_row.get("data");
                let eligible = plan_data["items"].as_array().is_some_and(|items| {
                    items
                        .iter()
                        .any(|i| i["id"] == parts[1] && i["type"] == activity)
                });
                if !eligible {
                    return Err(bad("The planned activity does not match this record."));
                }
                let used:bool=sqlx::query_scalar("select exists(select 1 from records where household_id=$1 and kind='event' and id<>$2 and deleted_at is null and data->>'planId'=$3)").persistent(false).bind(h).bind(id).bind(plan).fetch_one(&mut *tx).await?;
                if used {
                    return Err(Failure(
                        StatusCode::CONFLICT,
                        "That planned activity was already completed. Remove its link and retry."
                            .into(),
                        before,
                    ));
                }
            }
            if data["outcome"] == "no-result" {
                let linked:bool=sqlx::query_scalar("select exists(select 1 from records where household_id=$1 and kind='event' and deleted_at is null and data->>'tripId'=$2)").persistent(false).bind(h).bind(id.to_string()).fetch_one(&mut *tx).await?;
                if linked {
                    return Err(bad(
                        "This trip has potty events. Remove their links before marking no result.",
                    ));
                }
            }
        }
        "routine" => {
            if version > 0 {
                return Err(bad(
                    "Routine versions are immutable. Save a new version instead.",
                ));
            }
            let local_today: String =
                sqlx::query_scalar("select to_char(now() at time zone $1,'YYYY-MM-DD')")
                    .persistent(false)
                    .bind(hh["timezone"].as_str().unwrap_or("UTC"))
                    .fetch_one(&mut *tx)
                    .await?;
            if text(&data, "effectiveDate")? < local_today.as_str() {
                return Err(bad("Routine changes cannot rewrite past days."));
            }
            if data["effectiveDate"] == local_today {
                data["effectiveAt"] = json!(stamp());
            } else {
                data.as_object_mut().unwrap().remove("effectiveAt");
            }
            chrono::NaiveDate::parse_from_str(text(&data, "effectiveDate")?, "%Y-%m-%d")
                .map_err(|_| bad("Choose an effective date."))?;
            let items = data["items"]
                .as_array()
                .ok_or_else(|| bad("A routine needs an activity list."))?;
            if items.len() > 100 {
                return Err(bad("Keep routines to 100 items or fewer."));
            }
            let constraints=sqlx::query("select data from records where household_id=$1 and kind='constraint' and deleted_at is null").persistent(false).bind(h).fetch_all(&mut *tx).await?;
            for item in items {
                let time = item["time"].as_str().unwrap_or("");
                if chrono::NaiveTime::parse_from_str(time, "%H:%M").is_err() {
                    return Err(bad("Choose a valid routine time."));
                }
                if ![
                    "outside", "potty", "meal", "play", "training", "crate", "sleep",
                ]
                .contains(&item["type"].as_str().unwrap_or(""))
                {
                    return Err(bad("Choose a valid routine activity."));
                }
                uuid(item, "id")?;
                let days = item["days"]
                    .as_array()
                    .ok_or_else(|| bad("Choose routine days."))?;
                if days.is_empty() || days.iter().any(|d| d.as_u64().is_none_or(|n| n > 6)) {
                    return Err(bad("Choose valid routine days."));
                }
                let mut slots = vec![item.clone()];
                if let Some(exceptions) = item["exceptions"].as_object() {
                    if exceptions.len() > 366 {
                        return Err(bad("Too many routine exceptions."));
                    }
                    for (date, exception) in exceptions {
                        chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
                            .map_err(|_| bad("Choose a valid exception date."))?;
                        slots.push(exception.clone());
                    }
                }
                for slot in slots {
                    let slot_time = slot["time"].as_str().unwrap_or("");
                    if chrono::NaiveTime::parse_from_str(slot_time, "%H:%M").is_err() {
                        return Err(bad("Choose a valid routine time."));
                    }
                    if !slot["duration"].is_null()
                        && slot["duration"].as_u64().is_none_or(|v| v == 0 || v > 1440)
                    {
                        return Err(bad("Choose a duration between 1 and 1440 minutes."));
                    }
                    if item["trigger"].is_null() && slot["skipped"] != true {
                        for c in &constraints {
                            let c: Value = c.get("data");
                            if c["type"] == item["type"]
                                && (c["earliest"].as_str().is_some_and(|v| slot_time < v)
                                    || c["latest"].as_str().is_some_and(|v| slot_time > v))
                            {
                                return Err(bad(
                                    "This routine conflicts with a protected care instruction. Ask the owner to resolve it first.",
                                ));
                            }
                        }
                    }
                }
            }
            if version == 0 {
                let latest=sqlx::query("select id,data from records where household_id=$1 and kind='routine' and deleted_at is null order by created_at desc limit 1").persistent(false).bind(h).fetch_optional(&mut *tx).await?;
                if let Some(l) = latest {
                    if data["baseRoutineId"].as_str() != Some(&l.get::<Uuid, _>("id").to_string()) {
                        return Err(Failure(StatusCode::CONFLICT,"The routine changed while you were editing. Review the latest routine.".into(),Some(l.get("data"))));
                    }
                }
            }
        }
        "preference" => {
            if u.kiosk.is_some() {
                return Err(denied());
            }
            data["userId"] = json!(u.id);
            if let Some(b) = &before {
                if b["userId"] != json!(u.id) {
                    return Err(denied());
                }
            }
            let duplicate:bool=sqlx::query_scalar("select exists(select 1 from records where household_id=$1 and kind='preference' and actor_id=$2 and id<>$3 and deleted_at is null)").persistent(false).bind(h).bind(u.id).bind(id).fetch_one(&mut *tx).await?;
            if duplicate {
                return Err(bad(
                    "Refresh your reminder preferences before changing them.",
                ));
            }
        }
        "check" => {
            chrono::NaiveDate::parse_from_str(text(&data, "date")?, "%Y-%m-%d")
                .map_err(|_| bad("Choose a valid day."))?;
            if !["complete", "gaps", "unsure"].contains(&data["status"].as_str().unwrap_or("")) {
                return Err(bad("Choose a logging completeness status."));
            }
        }
        "constraint" => {
            if data["instruction"]
                .as_str()
                .is_none_or(|s| s.trim().is_empty())
            {
                return Err(bad("Describe the protected instruction."));
            }
        }
        _ => {}
    }
    let _ = hh;
    data["version"] = json!(version + 1);
    data["updatedAt"] = json!(stamp());
    data["actor"] = json!(u.name);
    data["actorId"] = json!(u.id);
    if before.is_none() {
        data["source"] = json!(if u.kiosk.is_some() {
            u.name.clone()
        } else {
            "Personal device".into()
        });
    }
    let deleted = data["deletedAt"].as_str().map(|_| Utc::now());
    if let Some(t) = deleted {
        data["deletedAt"] = json!(t.to_rfc3339());
    }
    sqlx::query("insert into records(id,household_id,kind,data,version,actor_id,deleted_at) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set data=excluded.data,version=excluded.version,actor_id=excluded.actor_id,updated_at=now(),deleted_at=excluded.deleted_at").persistent(false).bind(id).bind(h).bind(kind).bind(&data).bind(version+1).bind(u.id).bind(deleted).execute(&mut *tx).await?;
    sqlx::query("insert into history(id,household_id,kind,record_id,actor,before_data,after_data,actor_id) values($1,$2,$3,$4,$5,$6,$7,$8)").persistent(false).bind(operation).bind(h).bind(kind).bind(id).bind(&u.name).bind(&before).bind(&data).bind(u.id).execute(&mut *tx).await?;
    let result = json!({"record":data});
    sqlx::query("insert into mutation_receipts(id,household_id,actor_id,request_hash,result) values($1,$2,$3,$4,$5)").persistent(false).bind(operation).bind(h).bind(u.id).bind(digest).bind(&result).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(result)
}
