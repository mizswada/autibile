import sha256 from "crypto-js/sha256.js";

export default defineEventHandler(async (event) => {

  const body = await readBody(event);
  const { email, password, confirmPassword } = body;

  if (!email || !password || !confirmPassword) {
    return { status: 400, message: "All fields are required." };
  }

  if (password !== confirmPassword) {
    return { status: 400, message: "Passwords do not match." };
  }

  // Replace with your actual user lookup and update logic
  const user = await prisma.user.findFirst({ where: { userEmail: email } });

  if (!user) {
    return { status: 404, message: "User not found." };
  }

  const hashedPassword = sha256(password).toString();
  
  await prisma.user.update({
    where: { userID: user.userID },
    data: { userPassword: hashedPassword },
  });

  return { status: 200, message: "Password reset successful." };
});