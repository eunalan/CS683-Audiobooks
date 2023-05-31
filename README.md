# CS683-Audiobooks
* **audiobooks-backend** has the FastAPI backend code
* To deploy it run
```
gcloud app deploy audiobooks-backend-google/app.yaml
```

* **audiobooks-frontend** has the Next.js frontend code
* To deploy it run
```
gcloud app deploy audiobooks-frontend/app.yaml
```

* **openapi.yaml** is the Cloud Endpoints deployment file
* To deploy it run
```
gcloud endpoints services deploy openapi.yaml
```