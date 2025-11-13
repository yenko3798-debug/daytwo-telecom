-- CreateTable
CREATE TABLE "TopUpInvoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "payCurrency" TEXT,
    "payAmount" TEXT,
    "payAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invoiceUrl" TEXT NOT NULL,
    "nowpayInvoice" JSONB,
    "lastIpn" JSONB,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TopUpInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopUpInvoice_orderId_key" ON "TopUpInvoice"("orderId");
CREATE UNIQUE INDEX "TopUpInvoice_invoiceId_key" ON "TopUpInvoice"("invoiceId");
CREATE INDEX "TopUpInvoice_userId_idx" ON "TopUpInvoice"("userId");
CREATE INDEX "TopUpInvoice_status_idx" ON "TopUpInvoice"("status");

-- AddForeignKey
ALTER TABLE "TopUpInvoice" ADD CONSTRAINT "TopUpInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
