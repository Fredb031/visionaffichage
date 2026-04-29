"""Abstract base class for all SanMar PromoStandards SOAP services.

Built on `zeep` with a `requests.Session` transport tuned to:

  - 30s hard timeout (SanMar p99 ~3s; anything past 30s is hung).
  - 3 attempts with exponential backoff (1s / 2s / 4s) for transient
    network errors, mirroring the retry behavior in the existing
    TypeScript layer at supabase/functions/_shared/sanmar/client.ts.

The `_call` wrapper logs every operation (with passwords masked) and
maps zeep `Fault` exceptions to a typed `SanmarApiError` so callers can
branch on `code` rather than parsing strings.
"""
from __future__ import annotations

from abc import ABC
from functools import cached_property
from typing import Any, ClassVar, Optional

import requests
from loguru import logger
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from sanmar.config import Settings

# Lazy zeep import — tests run without zeep installed by mocking the
# `client` cached_property entirely.
try:  # pragma: no cover - import path tested implicitly
    from zeep import Client as _ZeepClient  # type: ignore
    from zeep.exceptions import Fault as _ZeepFault  # type: ignore
    from zeep.transports import Transport as _ZeepTransport  # type: ignore

    ZEEP_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only when zeep absent
    _ZeepClient = None  # type: ignore[assignment]
    _ZeepFault = Exception  # type: ignore[assignment,misc]
    _ZeepTransport = None  # type: ignore[assignment]
    ZEEP_AVAILABLE = False


# 30s hard ceiling — matches the TS layer's SOAP_TIMEOUT_MS.
SOAP_TIMEOUT_S = 30


class SanmarApiError(Exception):
    """Typed error raised when SanMar returns a fault or the SOAP transport
    surfaces an unrecoverable error.

    Attributes mirror what the TS `SanmarApiError` carries so logs are
    cross-readable between the two stacks.
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


def mask_password(d: dict[str, Any]) -> dict[str, Any]:
    """Return a shallow copy of `d` with any 'password'-like value replaced
    by '***'. Used before logging the auth dict so credentials never hit
    structured logs."""
    masked: dict[str, Any] = dict(d)
    for key in list(masked.keys()):
        if "password" in key.lower():
            masked[key] = "***"
    return masked


class SanmarServiceBase(ABC):
    """Abstract base — concrete services set `wsdl_path` and add operations.

    The zeep `Client` is built lazily on first use so unit tests can patch
    the `client` cached_property with a mock without ever touching the
    network or requiring zeep to be installed.
    """

    # Concrete services override (e.g. 'product/v2/?wsdl'). Class attribute
    # rather than abstract method so the value can be referenced before
    # instantiation.
    wsdl_path: ClassVar[str] = ""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        if not self.wsdl_path:
            raise NotImplementedError(
                f"{type(self).__name__} must set `wsdl_path`"
            )

    @property
    def service_url(self) -> str:
        """Full WSDL URL = configured base + per-service path."""
        return f"{self.settings.base_url}{self.wsdl_path}"

    @cached_property
    def session(self) -> requests.Session:
        """A `requests.Session` reused across calls. Per-call retries are
        layered on top via tenacity in `_call`; this just gives us
        connection pooling."""
        s = requests.Session()
        return s

    @cached_property
    def client(self) -> Any:
        """Lazily-instantiated zeep client. Raises `RuntimeError` if zeep
        is not installed — tests that don't need a live client should
        patch this property with a mock before any service method runs."""
        if not ZEEP_AVAILABLE:  # pragma: no cover - tested via mocking
            raise RuntimeError(
                "zeep is not installed. Install with `pip install zeep` "
                "or patch `client` in tests."
            )
        transport = _ZeepTransport(  # type: ignore[misc]
            session=self.session,
            timeout=SOAP_TIMEOUT_S,
            operation_timeout=SOAP_TIMEOUT_S,
        )
        return _ZeepClient(self.service_url, transport=transport)  # type: ignore[misc]

    def auth_dict(self) -> dict[str, str]:
        """Standard PromoStandards `{id, password}` auth fragment. Every
        service request embeds these top-level fields."""
        return {
            "id": self.settings.customer_id,
            "password": self.settings.password,
        }

    def _call(self, operation_name: str, **kwargs: Any) -> Any:
        """Invoke a SOAP operation by name with retries + masked logging.

        - Logs the operation with passwords scrubbed.
        - Retries `requests.ConnectionError` and `requests.Timeout` up to
          3 times with exponential backoff.
        - Maps `zeep.exceptions.Fault` to `SanmarApiError(code, message,
          operation=operation_name)`.
        """
        logger.info(
            "sanmar.call",
            operation=operation_name,
            service=type(self).__name__,
            params=mask_password(kwargs),
        )

        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=1, max=4),
            retry=retry_if_exception_type(
                (requests.ConnectionError, requests.Timeout)
            ),
            reraise=True,
        )
        def _invoke() -> Any:
            try:
                op = getattr(self.client.service, operation_name)
            except AttributeError as e:
                raise SanmarApiError(
                    f"Operation '{operation_name}' not found on service",
                    code="operation-not-found",
                    operation=operation_name,
                ) from e
            try:
                return op(**kwargs)
            except _ZeepFault as fault:  # type: ignore[misc]
                # zeep.Fault carries `.message`, `.code`, and possibly
                # `.detail`. Surface message + code in our typed error.
                code = getattr(fault, "code", None)
                msg = getattr(fault, "message", None) or str(fault)
                raise SanmarApiError(
                    str(msg),
                    code=str(code) if code is not None else None,
                    operation=operation_name,
                ) from fault

        return _invoke()
