FROM golang:1.22-alpine AS build
WORKDIR /src

# ابتدا فقط فایل‌های ماژول تا کش لایه‌ها با هر تغییر کد باطل نشود.
# go.sum عمداً با * آمده چون در نخستین clone هنوز ساخته نشده است.
COPY go.mod go.sum* ./
RUN go mod download || true

COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/seed   ./cmd/seed

FROM alpine:3.20
RUN adduser -D -u 10001 app
COPY --from=build /out/server /usr/local/bin/server
COPY --from=build /out/seed   /usr/local/bin/seed
USER app
EXPOSE 8080
CMD ["server"]
