<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/play-square.svg" width="60" height="60" alt="Monteeq Logo"/>
  <h1>Monteeq</h1>
  <p><em>A high-performance, full-stack video platform designed for creators.</em></p>
  
  [![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
  [![Rust](https://img.shields.io/badge/Media_Service-Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
  [![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
</div>

<hr/>

<h3>
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/sparkles.svg" width="20" height="20" alt="Features" align="center"/>
  Key Features
</h3>

<ul>
  <li><b>Modern UI/UX</b>: Responsive dark-mode interface built with React, Vite, and Framer Motion for smooth animations.</li>
  <li><b>Multi-Format Video Support</b>: Support for 'Home' (standard) and 'Flash' (short-form) video types.</li>
  <li><b>High-Speed Transcoding</b>: Dedicated Rust microservice for heavy video processing tasks.</li>
  <li><b>Creator Analytics</b>: Advanced performance tracking with monthly growth insights and interactive charts.</li>
  <li><b>Social Interactions</b>: Threaded comment system, likes, reposts, and real-time notifications.</li>
  <li><b>Achievement System</b>: Milestone tracking for creators to reward engagement.</li>
  <li><b>AWS S3 Storage</b>: Seamlessly integrated with AWS S3 for scalable media hosting.</li>
  <li><b>Secure Authentication</b>: Google OAuth2 integration and JWT-based session management.</li>
</ul>

<hr/>

<h3>
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/layers.svg" width="20" height="20" alt="Tech Stack" align="center"/>
  Tech Stack
</h3>

<table>
  <tr>
    <td><b>Frontend</b></td>
    <td>React 19, Vite, Framer Motion, Vanilla CSS, Recharts, Lucide React</td>
  </tr>
  <tr>
    <td><b>Backend</b></td>
    <td>FastAPI, Httpx, PostgreSQL, SQLAlchemy, Alembic</td>
  </tr>
  <tr>
    <td><b>Media Engine</b></td>
    <td>Rust (FFmpeg integration)</td>
  </tr>
  <tr>
    <td><b>Infrastructure</b></td>
    <td>AWS S3</td>
  </tr>
</table>

<hr/>

<h3>
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/lightbulb.svg" width="20" height="20" alt="Vision" align="center"/>
  Platform Vision
</h3>

Monteeq is built to redefine what a creator platform looks and feels like. We believe in providing an ultra-premium, cinematic experience—affectionately stylized as the **"Gilded Obsidian"** design system—that empowers creators to monetize effectively while engaging audiences in a hyper-optimized ecosystem.

**Key Ecosystem Highlights:**
- **Creator Monetization**: An embedded 'Monetization Widget' providing seamless tipping, premium subscriptions, and milestone-based community rewards.
- **Trophy Room & Gamification**: Interactive public profiles highlighting a creator's successes, challenge wins, and top-tier metrics to boost audience trust and engagement.
- **Performance Administration**: Detailed analytics tracking platform-wide growth curves, ensuring community administrators can maintain community health in real time.
- **Architectural Scalability**: Decoupling resource-heavy media transcoding into a specialized async Rust engine ensures that the FastAPI business layer remains consistently responsive, regardless of concurrent uploads.

<hr/>

<h3>
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/git-commit.svg" width="20" height="20" alt="Architecture" align="center"/>
  Architecture
</h3>

```mermaid
graph TD
    User([User]) -->|Interacts| Frontend[React Frontend]
    Frontend -->|API Requests| Backend[FastAPI Backend]
    Backend -->|Auth| Google[Google OAuth]
    Backend -->|Query/Update| Postgres[(PostgreSQL)]
    Backend -->|Enqueue Processing| VideoWorker[Rust Video Service]
    VideoWorker -->|Transcode| FFmpeg[FFmpeg Engine]
    FFmpeg -->|Store Fragments| S3[AWS S3 Storage]
    S3 -->|CDN Delivery| User
```

<hr/>

<div align="center">
  <p>This project is licensed under the MIT License - see the <a href="LICENSE">LICENSE</a> file for details.</p>
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/heart.svg" width="16" height="16" alt="Heart"/>
  <p><em>Made for the Creative Community</em></p>
</div>