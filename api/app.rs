#[path = "../server/app.rs"]
mod app;
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    dotenvy::dotenv().ok();
    let router = app::router().await?;
    if std::env::var("VERCEL").is_ok() {
        let service = tower::ServiceBuilder::new()
            .layer(vercel_runtime::axum::VercelLayer::new())
            .service(router);
        vercel_runtime::run(service).await?;
    } else {
        let port = std::env::var("PORT").unwrap_or("3001".into());
        let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{port}")).await?;
        println!("Wag API listening on http://127.0.0.1:{port}");
        axum::serve(listener, router).await?;
    }
    Ok(())
}
