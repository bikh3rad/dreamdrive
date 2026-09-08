// Package migrations فایل‌های SQL مهاجرت را در باینری جاسازی می‌کند.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
