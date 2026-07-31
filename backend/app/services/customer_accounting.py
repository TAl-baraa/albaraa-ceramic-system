from decimal import Decimal
from typing import Literal

TransactionType = Literal["debt", "credit", "payment_received", "payment_paid"]
BalanceStatus = Literal["owes_store", "store_owes", "settled"]
BALANCE_QUANTUM = Decimal("0.000001")


def transaction_effect(transaction_type: TransactionType, amount: Decimal) -> Decimal:
    """Return the signed customer-balance effect for one active transaction."""
    if transaction_type in ("debt", "payment_paid"):
        return amount.quantize(BALANCE_QUANTUM)
    return (-amount).quantize(BALANCE_QUANTUM)


def zero_balance() -> Decimal:
    return Decimal("0.000000")


def balance_status(balance: Decimal) -> BalanceStatus:
    if balance > 0:
        return "owes_store"
    if balance < 0:
        return "store_owes"
    return "settled"
