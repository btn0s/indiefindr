import Image from "next/image";
import logoIcon from "@/app/icon.svg";

const Logo = () => {
  return <Image src={logoIcon} alt="indieblargenhagen" className="size-4" />;
};

export default Logo;
