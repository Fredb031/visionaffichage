"""Typed exceptions for the SanMar integration.

Extracted from ``sanmar.services.base`` so all error classes live in one
module and can be imported without dragging the SOAP plumbing along.
``base.py`` re-exports :class:`SanmarApiError` for backward compatibility.

Error code catalogue
--------------------
* ``210`` — forbidden character in a user-supplied field (matches
  SanMar's "Invalid Character" rejection code from the PO PDF).
* ``220`` — postal code does not match the country's expected format.
* ``230`` — carrier code is not in the supported allowlist.

These codes are surfaced as ``str`` to mirror what zeep / SanMar return
on the wire.
"""
from __future__ import annotations

from typing import Optional


class SanmarApiError(Exception):
    """Typed error raised when SanMar returns a fault or the SOAP transport
    surfaces an unrecoverable error.

    Attributes mirror what the TypeScript ``SanmarApiError`` carries so
    logs are cross-readable between the two stacks.
    """

    def __init__(
        self,
        message: str,
        *,
        code: Optional[str] = None,
        operation: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.code: Optional[str] = code
        self.message: str = message
        self.operation: Optional[str] = operation

    def __str__(self) -> str:  # pragma: no cover - trivial format
        return f"[{self.code}] {self.message} (operation: {self.operation})"


class ForbiddenCharError(SanmarApiError):
    """Raised pre-flight when an order field contains a SanMar-rejected
    character. Code ``210`` mirrors SanMar's own rejection code so logs
    line up with what would have come back from the gateway."""

    def __init__(self, field: str, char: str) -> None:
        super().__init__(
            f"Forbidden character {char!r} in field {field!r}",
            code="210",
        )
        self.field = field
        self.char = char


class InvalidPostalCodeError(SanmarApiError):
    """Raised when a postal code does not match the country's regex
    (Canadian ``A1A 1A1`` or US ``12345`` / ``12345-6789``)."""

    def __init__(self, postal: str, country: str) -> None:
        super().__init__(
            f"Invalid postal code {postal!r} for country {country!r}",
            code="220",
        )
        self.postal = postal
        self.country = country


class InvalidCarrierError(SanmarApiError):
    """Raised when a carrier code is not in the supported allowlist
    (``UPS`` / ``PUR`` / ``FDX`` / ``CPC``)."""

    def __init__(self, carrier: str) -> None:
        super().__init__(
            f"Unsupported carrier {carrier!r}; "
            f"allowed: UPS, PUR, FDX, CPC",
            code="230",
        )
        self.carrier = carrier
