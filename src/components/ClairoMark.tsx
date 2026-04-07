export const ClairoMark = ({ className = "w-12 h-12" }) => (
    <div className={`${className} rounded-xl bg-white flex items-center justify-center shadow-sm`}>
      <div className="relative w-[58%] h-[58%]">
        <div className="absolute inset-0 rounded-full border-[3px] border-black border-r-transparent border-b-transparent rotate-45" />
        <div className="absolute inset-[17.5%] rounded-full border-[3px] border-black border-l-transparent border-t-transparent rotate-45" />
        <div className="absolute w-[22%] h-[22%] bg-black rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>
  );