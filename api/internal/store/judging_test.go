package store

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCommitHashIsDeterministicAndBinding(t *testing.T) {
	a := CommitHash(0.4621, 0.3880, "secret-nonce")
	b := CommitHash(0.4621, 0.3880, "secret-nonce")
	if a != b {
		t.Fatalf("same inputs must produce the same commit hash")
	}
	if len(a) != 64 {
		t.Fatalf("expected 64-char sha256 hex digest, got %d", len(a))
	}

	// تغییر هر ورودی باید هش را عوض کند — یعنی داور نمی‌تواند بعداً رأیش را جا بزند
	cases := []struct {
		name string
		got  string
	}{
		{"different x", CommitHash(0.4622, 0.3880, "secret-nonce")},
		{"different y", CommitHash(0.4621, 0.3881, "secret-nonce")},
		{"different nonce", CommitHash(0.4621, 0.3880, "other-nonce")},
	}
	for _, c := range cases {
		if c.got == a {
			t.Errorf("%s: hash collided with the original commitment", c.name)
		}
	}
}

func TestEntryHashChainsAndDetectsTampering(t *testing.T) {
	id, uid, cid := uuid.New(), uuid.New(), uuid.New()
	at := time.Date(2026, 9, 8, 12, 0, 0, 0, time.UTC)

	h1 := EntryHash("", id, uid, cid, 0.5, 0.5, at)
	if h1 == "" || len(h1) != 64 {
		t.Fatalf("expected a 64-char digest, got %q", h1)
	}

	// همان ورودی با prev متفاوت → هش متفاوت (زنجیره واقعاً به قبلی وابسته است)
	if h2 := EntryHash("abc", id, uid, cid, 0.5, 0.5, at); h2 == h1 {
		t.Error("hash must depend on the previous hash in the chain")
	}
	// دستکاری مختصات باید تشخیص داده شود
	if h3 := EntryHash("", id, uid, cid, 0.5001, 0.5, at); h3 == h1 {
		t.Error("hash must change when the coordinates change")
	}
	// دستکاری زمان باید تشخیص داده شود
	if h4 := EntryHash("", id, uid, cid, 0.5, 0.5, at.Add(time.Nanosecond)); h4 == h1 {
		t.Error("hash must change when the timestamp changes")
	}
}

func TestDistance(t *testing.T) {
	if d := Distance(0, 0, 3, 4); d != 5 {
		t.Errorf("expected 5, got %v", d)
	}
	if d := Distance(0.5, 0.5, 0.5, 0.5); d != 0 {
		t.Errorf("identical points must have zero distance, got %v", d)
	}
}
