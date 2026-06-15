build:
	go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

clean:
	rm -rf bin/ data/

dev:
	go run ./cmd/server

.PHONY: build run clean dev
