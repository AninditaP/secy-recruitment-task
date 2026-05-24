FROM python:3.11-slim

ARG SERVER_ID=server1
ARG PORT=8001

ENV SERVER_ID=${SERVER_ID}
ENV PORT=${PORT}

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ${SERVER_ID}/ .
COPY canvas/ ./canvas/

EXPOSE ${PORT}

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT} --reload