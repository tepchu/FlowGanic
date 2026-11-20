FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY app.py .
RUN useradd --system --uid 10001 --home-dir /app flowganic && mkdir /data && chown flowganic:flowganic /data
USER flowganic
EXPOSE 8000
CMD ["python", "app.py"]

