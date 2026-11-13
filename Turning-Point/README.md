# EventInsight AI — Enterprise Event Intelligence Platform

AI-powered event intelligence platform designed to ingest, normalize, and visualize heterogeneous enterprise event streams (Flight, NOTAM, Weather, Airport ops) from Solace PubSub+ brokers, Excel feeds, and databases.

---

## Architecture

$$\text{Data Sources (Excel / Solace)} \longrightarrow \text{Normalization Engine} \longrightarrow \text{MongoDB (Document Store)} \longrightarrow \text{FastAPI} \longrightarrow \text{React + Vite UI}$$

* **Frontend:** React 19 + Vite (Port `3000`) — Bespoke enterprise dark dashboard with payload inspector drawer.
* **Backend API:** Python FastAPI + Uvicorn (Port `8000`) — REST endpoints for events, stats, and telemetry.
* **Database:** MongoDB 7.0/8.0 (Port `27017`) — Heterogeneous document store with compound indexes.
* **DevOps / Orchestration:** Docker Compose (`docker-compose.yml`) — MongoDB + Mongo Express UI + n8n.

---

## Quick Start Guide for Team Members

Follow these 4 simple steps to run the complete project on your machine:

### 1. Start MongoDB (Using the YAML file)

If you have Docker Desktop installed, run:
```bash
docker compose up -d
```
> This starts:
> - **MongoDB** on `localhost:27017`
> - **Mongo Express (Database Web Viewer)** on `http://localhost:8081`
> - **n8n Workflow Engine** on `http://localhost:5678`

*(If you already have MongoDB installed natively on Windows/Mac, you can skip `docker compose` and use your local MongoDB service directly).*

---

### 2. Ingest the Event Data into MongoDB

Install Python requirements and run the ingestion engine:
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the ingestion pipeline (ingests 11 Excel workbooks)
python ingestion/ingest_excel.py
```
> You will see `109 unique records` safely ingested into MongoDB with zero duplicate records.

To run automated tests:
```bash
python -m pytest tests/test_normalizer.py -v
```

---

### 3. Start the Backend API Server

In a new terminal:
```bash
python -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
```
* API Health Check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
* Interactive Swagger Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### 4. Start the React Frontend

In another terminal:
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## Repository Structure

```
Turning-Point/
├── docker-compose.yml          # Docker services: MongoDB, Mongo Express, n8n
├── requirements.txt            # Python dependencies (FastAPI, PyMongo, Pandas, OpenpyXL)
├── .env.example                # Example environment variables
├── .gitignore                  # Git ignore rules (node_modules, caches, secrets)
├── ingestion/                  # Ingestion & Normalization engine
│   ├── excel_normalizer.py     # Cleans NaNs, classifies Flight/NOTAM, deduplicates
│   ├── ingest_excel.py         # Bulk MongoDB upsert runner with indexes
│   └── n8n_workflows/          # Importable n8n workflow JSON
├── server/
│   └── main.py                 # FastAPI backend REST bridge
├── frontend/                   # React + Vite application
│   ├── src/
│   │   ├── components/         # Sidebar, TopBar, Drawer (Payload Inspector)
│   │   └── views/              # Overview, Messages (Dual stream), AI, Analytics, Sources
│   └── vite.config.js          # API proxy configuration
├── dataset/                    # Synthetic Excel data & raw aviation XMLs
└── tests/                      # Automated test suite
```

