import Paystack from "paystack";
import { prisma } from "../server";

const validateTransaction = async (paystackRef: string) => {
  const transaction = await prisma.transaction.findUnique({
    where: { paystackRef },
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }
  //check status on paystack
  const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY!);
  const status = await paystack.transaction.verify(paystackRef);
  if (status.data.status !== "success") {
    return ;
  }
 


 
};

export default validateTransaction;