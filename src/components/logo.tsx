import Image from "next/image";
import logoIcon from "@/assets/logo.svg";

const Logo = () => {
  return <Image src={logoIcon} alt="IndieFindr" className="size-4" />;
};

export default Logo;
