"""add_noshow_status_and_appointment_fields

Revision ID: 05b1234abcde
Revises: 04a0440c36eb
Create Date: 2026-04-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05b1234abcde'
down_revision: Union[str, None] = '04a0440c36eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add NOSHOW enum value and new tracking columns to appointments."""
    # Add NOSHOW to the PostgreSQL enum type
    op.execute("ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'NOSHOW' AFTER 'RESCHEDULED'")

    # Add new columns to appointments table
    op.add_column('appointments', sa.Column('cancellation_reason', sa.String(500), nullable=True))
    op.add_column('appointments', sa.Column('deposit_paid', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('appointments', sa.Column('reschedule_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('appointments', sa.Column('reschedule_fee_applied', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Remove new columns (enum value cannot be removed in PostgreSQL)."""
    op.drop_column('appointments', 'reschedule_fee_applied')
    op.drop_column('appointments', 'reschedule_count')
    op.drop_column('appointments', 'deposit_paid')
    op.drop_column('appointments', 'cancellation_reason')
    # Note: PostgreSQL does not support removing enum values without recreating the type.
