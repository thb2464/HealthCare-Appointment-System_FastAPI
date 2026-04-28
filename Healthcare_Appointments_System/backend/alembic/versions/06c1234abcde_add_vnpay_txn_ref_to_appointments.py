"""add vnpay_txn_ref to appointments

Revision ID: 06c1234abcde
Revises: 05b1234abcde
Create Date: 2026-04-27

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "06c1234abcde"
down_revision = "05b1234abcde"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("vnpay_txn_ref", sa.String(length=100), nullable=True),
    )
    op.create_index(
        op.f("ix_appointments_vnpay_txn_ref"),
        "appointments",
        ["vnpay_txn_ref"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_appointments_vnpay_txn_ref"),
        table_name="appointments",
    )
    op.drop_column("appointments", "vnpay_txn_ref")
