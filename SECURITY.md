# Security policy

RedactZero is a client-side privacy tool. Documents are decoded, redacted and re-encoded in the
browser tab; there is no backend, no account system, no telemetry and no remote asset. The
security model and its limits are documented in the [README](README.md#security-model).

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private vulnerability reporting:

**https://github.com/jamamjadalone/redact-zero/security/advisories/new**

If that channel is unavailable, contact [@jamamjadalone](https://github.com/jamamjadalone) on
GitHub to arrange a private channel before sharing any details.

A useful report includes:

- the affected version (shown in the header) or commit SHA
- browser and operating system
- clear reproduction steps
- the impact you believe it has
- a proof of concept, if it is safe to share one

**Never attach a real ID, passport, driving licence, bank statement, utility bill or any other
personal document.** Use the built-in demo document or a synthetic file you created. Redact or
replace all personal data in screenshots, logs and file names.

## Scope

In scope:

- any outbound request or telemetry from the app
- source metadata (EXIF, XMP, PNG text chunks, PDF author fields) surviving an export
- redaction pixels that can be recovered, or exported PDFs that still contain a text layer or
  annotations
- Content-Security-Policy bypass, script injection or service-worker cache poisoning
- a guard failing to stop files over 200 MB or PDFs over 100 pages

Out of scope:

- a compromised browser, operating system, extension or clipboard
- someone photographing the screen
- watermark removal by cropping
- social engineering
- the documented limitations in the README (pixelation is not a guarantee, HEIC needs Safari
  or a JPEG conversion, exported PDFs are rasterised on purpose)

## Supported versions

Only the latest release on `main` is supported. There is no LTS branch.

## Disclosure

We aim to acknowledge a report within 7 days and to ship a fix or mitigation as soon as
practical. Please allow a reasonable window before public disclosure.

This is a free MIT project, so there is no paid bug bounty.
