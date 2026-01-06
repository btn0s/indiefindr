import Image from "next/image";
import logoIcon from "@/app/icon.svg";

const Logo = () => {
  return <Image src={logoIcon} alt="IndieFindr" className="size-4" />;
};

export default Logo;
