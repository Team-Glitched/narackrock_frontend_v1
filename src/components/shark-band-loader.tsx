import { useState, type ReactNode } from "react";
import "./shark-band-loader.css";
import { SHARK_MEMBER_SPECS, pickNextSharkMember, type SharkMember } from "./shark-member";

import rawVector42 from "@/assets/loading-band/78fc5.svg?raw";
import rawVector43 from "@/assets/loading-band/8d4eb.svg?raw";
import rawGroup111 from "@/assets/loading-band/0e5e7.svg?raw";
import rawVector64 from "@/assets/loading-band/9035f.svg?raw";
import rawVector62 from "@/assets/loading-band/64374.svg?raw";
import rawVector65 from "@/assets/loading-band/862fa.svg?raw";
import rawVector44 from "@/assets/loading-band/5d158.svg?raw";
import rawVector45 from "@/assets/loading-band/a81e0.svg?raw";
import rawEllipse9 from "@/assets/loading-band/ca8d2.svg?raw";
import rawGroup117 from "@/assets/loading-band/611ff.svg?raw";
import rawVector63 from "@/assets/loading-band/b89ec.svg?raw";
import rawGroup128 from "@/assets/loading-band/e97d0.svg?raw";
import rawVector46 from "@/assets/loading-band/491b2.svg?raw";
import rawEllipse10 from "@/assets/loading-band/d4269.svg?raw";
import rawGroup112 from "@/assets/loading-band/e864b.svg?raw";
import rawVector66 from "@/assets/loading-band/7101a.svg?raw";
import rawVector67 from "@/assets/loading-band/86fe3.svg?raw";
import rawVector68 from "@/assets/loading-band/b2f6b.svg?raw";
import rawGroup127 from "@/assets/loading-band/39b3a.svg?raw";
import rawVector69 from "@/assets/loading-band/fbc7c.svg?raw";
import rawVector47 from "@/assets/loading-band/c082a.svg?raw";
import rawVector48 from "@/assets/loading-band/c2cf7.svg?raw";
import rawVector70 from "@/assets/loading-band/bbf35.svg?raw";
import rawGroup130 from "@/assets/loading-band/6af23.svg?raw";
import rawVector71 from "@/assets/loading-band/735b5.svg?raw";
import rawGroup113 from "@/assets/loading-band/1dd78.svg?raw";
import rawVector72 from "@/assets/loading-band/f8c66.svg?raw";
import rawVector73 from "@/assets/loading-band/5d201.svg?raw";
import rawVector74 from "@/assets/loading-band/6a54e.svg?raw";
import rawVector75 from "@/assets/loading-band/84ac6.svg?raw";
import rawGroup152 from "@/assets/loading-band/0da1e.svg?raw";
import rawGroup133 from "@/assets/loading-band/24d2c.svg?raw";
import rawGroup138 from "@/assets/loading-band/391f8.svg?raw";
import rawGroup134 from "@/assets/loading-band/c8d8e.svg?raw";
import rawGroup139 from "@/assets/loading-band/66e82.svg?raw";
import rawGroup135 from "@/assets/loading-band/e1710.svg?raw";
import rawGroup136 from "@/assets/loading-band/2819c.svg?raw";
import rawGroup140 from "@/assets/loading-band/aacba.svg?raw";
import rawGroup141 from "@/assets/loading-band/6b043.svg?raw";
import rawGroup143 from "@/assets/loading-band/7be86.svg?raw";
import rawGroup146 from "@/assets/loading-band/6b7ea.svg?raw";
import rawGroup147 from "@/assets/loading-band/6d52f.svg?raw";
import rawGroup148 from "@/assets/loading-band/daa82.svg?raw";
import rawGroup149 from "@/assets/loading-band/22b8c.svg?raw";
import rawGroup144 from "@/assets/loading-band/6b2ff.svg?raw";
import rawRectangle458 from "@/assets/loading-band/ada94.svg?raw";
import rawGroup132 from "@/assets/loading-band/29d2b.svg?raw";
import rawGroup137 from "@/assets/loading-band/2236f.svg?raw";
import rawGroup142 from "@/assets/loading-band/6144a.svg?raw";
import rawGroup145 from "@/assets/loading-band/a9534.svg?raw";
import rawGroup150 from "@/assets/loading-band/ad562.svg?raw";
import rawGroup151 from "@/assets/loading-band/da4a2.svg?raw";
import rawGroup153 from "@/assets/loading-band/26c8b.svg?raw";
import rawGroup154 from "@/assets/loading-band/5b2e8.svg?raw";
import rawGroup155 from "@/assets/loading-band/f56e2.svg?raw";

function toSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const imgVector42 = toSvgDataUrl(rawVector42);
const imgVector43 = toSvgDataUrl(rawVector43);
const imgGroup111 = toSvgDataUrl(rawGroup111);
const imgVector64 = toSvgDataUrl(rawVector64);
const imgVector62 = toSvgDataUrl(rawVector62);
const imgVector65 = toSvgDataUrl(rawVector65);
const imgVector44 = toSvgDataUrl(rawVector44);
const imgVector45 = toSvgDataUrl(rawVector45);
const imgEllipse9 = toSvgDataUrl(rawEllipse9);
const imgGroup117 = toSvgDataUrl(rawGroup117);
const imgVector63 = toSvgDataUrl(rawVector63);
const imgGroup128 = toSvgDataUrl(rawGroup128);
const imgVector46 = toSvgDataUrl(rawVector46);
const imgEllipse10 = toSvgDataUrl(rawEllipse10);
const imgGroup112 = toSvgDataUrl(rawGroup112);
const imgVector66 = toSvgDataUrl(rawVector66);
const imgVector67 = toSvgDataUrl(rawVector67);
const imgVector68 = toSvgDataUrl(rawVector68);
const imgGroup127 = toSvgDataUrl(rawGroup127);
const imgVector69 = toSvgDataUrl(rawVector69);
const imgVector47 = toSvgDataUrl(rawVector47);
const imgVector48 = toSvgDataUrl(rawVector48);
const imgVector70 = toSvgDataUrl(rawVector70);
const imgGroup130 = toSvgDataUrl(rawGroup130);
const imgVector71 = toSvgDataUrl(rawVector71);
const imgGroup113 = toSvgDataUrl(rawGroup113);
const imgVector72 = toSvgDataUrl(rawVector72);
const imgVector73 = toSvgDataUrl(rawVector73);
const imgVector74 = toSvgDataUrl(rawVector74);
const imgVector75 = toSvgDataUrl(rawVector75);
const imgGroup152 = toSvgDataUrl(rawGroup152);
const imgGroup133 = toSvgDataUrl(rawGroup133);
const imgGroup138 = toSvgDataUrl(rawGroup138);
const imgGroup134 = toSvgDataUrl(rawGroup134);
const imgGroup139 = toSvgDataUrl(rawGroup139);
const imgGroup135 = toSvgDataUrl(rawGroup135);
const imgGroup136 = toSvgDataUrl(rawGroup136);
const imgGroup140 = toSvgDataUrl(rawGroup140);
const imgGroup141 = toSvgDataUrl(rawGroup141);
const imgGroup143 = toSvgDataUrl(rawGroup143);
const imgGroup146 = toSvgDataUrl(rawGroup146);
const imgGroup147 = toSvgDataUrl(rawGroup147);
const imgGroup148 = toSvgDataUrl(rawGroup148);
const imgGroup149 = toSvgDataUrl(rawGroup149);
const imgGroup144 = toSvgDataUrl(rawGroup144);
const imgRectangle458 = toSvgDataUrl(rawRectangle458);
const imgGroup132 = toSvgDataUrl(rawGroup132);
const imgGroup137 = toSvgDataUrl(rawGroup137);
const imgGroup142 = toSvgDataUrl(rawGroup142);
const imgGroup145 = toSvgDataUrl(rawGroup145);
const imgGroup150 = toSvgDataUrl(rawGroup150);
const imgGroup151 = toSvgDataUrl(rawGroup151);
const imgGroup153 = toSvgDataUrl(rawGroup153);
const imgGroup154 = toSvgDataUrl(rawGroup154);
const imgGroup155 = toSvgDataUrl(rawGroup155);
function DrummerShark() {
  return (
    <div className="relative h-[1060px] w-[1170px] overflow-visible" data-shark-member="drummer">
      <div className="pointer-events-none absolute left-[-638px] top-0 h-[1746px] w-[2993px]">
      <div className="absolute contents left-[638px] top-0" data-node-id="22201:721">
        <div className="absolute h-[711.8231811523438px] left-[838px] overflow-visible top-0 w-[713.0000610351562px]" data-node-id="22201:722">
          <div className="relative size-full" data-motion-for="22201:722">
            <div className="absolute contents h-[711.823px] left-0 top-0 w-[713px]" data-node-id="22201:723">
              <div className="absolute flex h-[115.029px] items-center justify-center left-[471.7px] top-[240.57px] w-[120.615px]" data-node-id="22201:724">
                <div className="flex-none transform-[matrix(-0.4100770610198907,_-0.9120508331050843,_0.9120508331050843,_-0.4100770610198907,_0,_0)]">
                  <div className="h-[94.68px] relative w-[83.551px]" data-motion-for="22201:724">
                    <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector71} />
                  </div>
                </div>
              </div>
              <div className="absolute flex h-[203.434px] items-center justify-center left-[445.51px] top-[107.04px] w-[142.425px]" data-node-id="22201:725">
                <div className="flex-none transform-[matrix(-0.8281879334514723,_0.5604504848686709,_0.5604504848686709,_0.8281879334514723,_0,_0)]">
                  <div className="bg-[#583200] h-[238.465px] relative rounded-[6px] w-[10.598px]" data-motion-for="22201:725" />
                </div>
              </div>
              <div className="absolute flex h-[706.76px] items-center justify-center left-[2.57px] top-[2.53px] w-[707.864px]" data-node-id="22201:726">
                <div className="-scale-y-100 flex-none rotate-[141.2deg]">
                  <div className="h-[499.476px] relative w-[506.701px]">
                    <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup113} />
                  </div>
                </div>
              </div>
              <div className="absolute flex h-[193.286px] items-center justify-center left-[347.6px] top-[356.1px] w-[156.66px]" data-node-id="22201:730">
                <div className="flex-none transform-[matrix(-0.7828919234643195,_-0.62215775021361,_-0.62215775021361,_0.7828919234643195,_0,_0)]">
                  <div className="bg-[#583200] h-[238.465px] relative rounded-[6px] w-[10.598px]" data-motion-for="22201:730" />
                </div>
              </div>
              <div className="absolute flex h-[92.09px] items-center justify-center left-[315.58px] top-[428.17px] w-[114.512px]" data-node-id="22201:731">
                <div className="flex-none transform-[matrix(-0.3793594612458726,_0.9252491699916803,_-0.9252491699916803,_-0.3793594612458726,_0,_0)]">
                  <div className="h-[99.719px] relative w-[58.644px]" data-motion-for="22201:731">
                    <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector72} />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute flex h-[10.713px] items-center justify-center left-[338.1px] top-[350.81px] w-[5.267px]" data-node-id="22201:732">
              <div className="-scale-y-100 flex-none rotate-[169.83deg]">
                <div className="h-[10.255px] relative w-[3.511px]">
                  <div className="absolute inset-[-114.29%_-142.39%_-48.77%_-142.4%]">
                    <img draggable={false} alt="" className="block max-w-none size-full" src={imgVector73} />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute flex h-[10.644px] items-center justify-center left-[327.5px] top-[385.78px] w-[4.908px]" data-node-id="22201:733">
              <div className="-scale-y-100 flex-none rotate-[171.98deg]">
                <div className="h-[10.255px] relative w-[3.511px]">
                  <div className="absolute inset-[-91.43%_-113.92%_-39.01%_-113.92%]">
                    <img draggable={false} alt="" className="block max-w-none size-full" src={imgVector74} />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute flex h-[10.631px] items-center justify-center left-[359.3px] top-[393.2px] w-[4.847px]" data-node-id="22201:734">
              <div className="-scale-y-100 flex-none rotate-[172.34deg]">
                <div className="h-[10.255px] relative w-[3.511px]">
                  <div className="absolute inset-[-68.57%_-85.44%_-29.26%_-85.44%]">
                    <img draggable={false} alt="" className="block max-w-none size-full" src={imgVector75} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute contents left-[638px] top-[319px]" data-node-id="22201:735">
          <div className="absolute flex h-[629.229px] items-center justify-center left-[1507.16px] top-[358.7px] w-[300.18px]" data-node-id="22201:736">
            <div className="-scale-y-100 flex-none rotate-180">
              <div className="h-[629.229px] relative w-[300.18px]">
                <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup152} />
              </div>
            </div>
          </div>
          <div className="absolute contents h-[210.179px] left-[971.18px] top-[429.48px] w-[236.746px]" data-node-id="22201:760">
            <div className="absolute flex h-[6.454px] items-center justify-center left-[999.29px] top-[609.37px] w-[7.263px]" data-node-id="22201:761">
              <div className="flex-none rotate-[-3.52deg]">
                <div className="bg-[#7e7e7e] h-[6.042px] relative w-[6.905px]" />
              </div>
            </div>
            <div className="absolute flex h-[8.774px] items-center justify-center left-[999.13px] top-[607.05px] w-[3.114px]" data-node-id="22201:762">
              <div className="flex-none rotate-[-3.52deg]">
                <div className="bg-[#7e7e7e] h-[8.631px] relative w-[2.589px]" />
              </div>
            </div>
            <div className="absolute flex h-[7.965px] items-center justify-center left-[1193.82px] top-[595.02px] w-[3.923px]" data-node-id="22201:763">
              <div className="flex-none rotate-[-3.52deg]">
                <div className="bg-[#7e7e7e] h-[7.768px] relative w-[3.452px]" />
              </div>
            </div>
            <div className="absolute flex h-[5.593px] items-center justify-center left-[1190.54px] top-[597.61px] w-[7.21px]" data-node-id="22201:764">
              <div className="flex-none rotate-[-3.52deg]">
                <div className="bg-[#7e7e7e] h-[5.179px] relative w-[6.905px]" />
              </div>
            </div>
            <div className="absolute flex h-[49.371px] items-center justify-center left-[992.15px] top-[563.27px] w-[14.191px]" data-node-id="22201:765">
              <div className="flex-none rotate-[-3.53deg] skew-x-[-0.01deg]">
                <div className="bg-[#7e7e7e] h-[48.772px] relative w-[11.221px]" />
              </div>
            </div>
            <div className="absolute flex h-[49.371px] items-center justify-center left-[1187.7px] top-[551.22px] w-[14.191px]" data-node-id="22201:766">
              <div className="flex-none rotate-[-3.53deg] skew-x-[-0.01deg]">
                <div className="bg-[#7e7e7e] h-[48.772px] relative w-[11.221px]" />
              </div>
            </div>
            <div className="absolute flex h-[160.255px] items-center justify-center left-[991.17px] top-[465.6px] w-[207.25px]" data-node-id="22201:767">
              <div className="flex-none rotate-[-3.52deg]">
                <div className="h-[148.35px] relative w-[198.518px]">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup133} />
                </div>
              </div>
            </div>
            <div className="absolute contents h-[185.011px] left-[981.79px] top-[442.06px] w-[215.509px]" data-node-id="22201:771">
              <div className="absolute flex h-[14.963px] items-center justify-center left-[1077.69px] top-[601.96px] w-[6.07px]" data-node-id="22201:772">
                <div className="flex-none rotate-[-3.52deg]">
                  <div className="bg-[#7e7e7e] h-[14.673px] relative w-[5.179px]" />
                </div>
              </div>
              <div className="absolute flex h-[14.963px] items-center justify-center left-[1113.02px] top-[599.79px] w-[6.07px]" data-node-id="22201:773">
                <div className="flex-none rotate-[-3.52deg]">
                  <div className="bg-[#7e7e7e] h-[14.673px] relative w-[5.179px]" />
                </div>
              </div>
              <div className="absolute flex h-[14.551px] items-center justify-center left-[1077.11px] top-[590.31px] w-[41.232px]" data-node-id="22201:774">
                <div className="flex-none rotate-[-3.52deg]">
                  <div className="bg-[#7e7e7e] h-[12.084px] relative w-[40.566px]" />
                </div>
              </div>
              <div className="absolute flex h-[138.638px] items-center justify-center left-[1086.5px] top-[463.78px] w-[15.392px]" data-node-id="22201:775">
                <div className="flex-none rotate-[-3.52deg]">
                  <div className="bg-[#7e7e7e] h-[138.476px] relative w-[6.905px]" />
                </div>
              </div>
              <div className="absolute flex h-[38.187px] items-center justify-center left-[1024.32px] top-[580.3px] w-[13.504px]" data-node-id="22201:776">
                <div className="flex-none rotate-[-3.52deg] skew-x-[-0.01deg]">
                  <div className="bg-[#7e7e7e] h-[37.568px] relative w-[11.221px]" />
                </div>
              </div>
              <div className="absolute flex h-[38.187px] items-center justify-center left-[1157.85px] top-[572.08px] w-[13.504px]" data-node-id="22201:777">
                <div className="flex-none rotate-[-3.52deg] skew-x-[-0.01deg]">
                  <div className="bg-[#7e7e7e] h-[37.568px] relative w-[11.221px]" />
                </div>
              </div>
              <div className="absolute flex h-[105.095px] items-center justify-center left-[986.04px] top-[442.06px] w-[211.259px]" data-node-id="22201:778">
                <div className="flex-none rotate-[3.04deg]">
                  <div className="h-[94.259px] relative w-[206.545px]">
                    <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup138} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute h-[218.0028303725153px] left-[1274.12px] overflow-visible top-[434.06px] w-[245.8118035921898px]" data-node-id="22201:796">
            <div className="flex items-center justify-center relative size-full">
              <div className="flex-none h-[192.88992309570312px] transform-[matrix(0.9930427074432373,_0.11775466799736023,_-0.11775466799736023,_0.9930427074432373,_0,_0)] w-[224.66114807128906px]">
                <div className="relative size-full" data-motion-for="22201:796">
                  <div className="h-[192.88992309570312px] origin-[0_0] transform-[matrix(0.9930427266671905,_-0.1177546702769301,_0.1177546702769301,_0.9930427266671905,_-22.555663512416004,_2.674642941795639)] w-[224.66114807128906px]">
                    <div className="absolute flex h-[6.813px] items-center justify-center left-[19.97px] top-[164.92px] w-[7.568px]" data-node-id="22201:797">
                      <div className="flex-none rotate-[6.76deg]">
                        <div className="bg-[#7e7e7e] h-[6.042px] relative w-[6.905px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[8.876px] items-center justify-center left-[19.98px] top-[162.35px] w-[3.587px]" data-node-id="22201:798">
                      <div className="flex-none rotate-[6.76deg]">
                        <div className="bg-[#7e7e7e] h-[8.631px] relative w-[2.589px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[8.12px] items-center justify-center left-[213.78px] top-[185.31px] w-[4.343px]" data-node-id="22201:799">
                      <div className="flex-none rotate-[6.76deg]">
                        <div className="bg-[#7e7e7e] h-[7.768px] relative w-[3.452px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[5.955px] items-center justify-center left-[210.36px] top-[187.48px] w-[7.466px]" data-node-id="22201:800">
                      <div className="flex-none rotate-[6.76deg]">
                        <div className="bg-[#7e7e7e] h-[5.179px] relative w-[6.905px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[49.752px] items-center justify-center left-[16.1px] top-[118.55px] w-[16.885px]" data-node-id="22201:801">
                      <div className="flex-none rotate-[6.75deg] skew-x-[-0.01deg]">
                        <div className="bg-[#7e7e7e] h-[48.772px] relative w-[11.221px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[49.752px] items-center justify-center left-[210.66px] top-[141.59px] w-[16.885px]" data-node-id="22201:802">
                      <div className="flex-none rotate-[6.75deg] skew-x-[-0.01deg]">
                        <div className="bg-[#7e7e7e] h-[48.772px] relative w-[11.221px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[169.338px] items-center justify-center left-[18.79px] top-[34.93px] w-[214.439px]" data-node-id="22201:803">
                      <div className="flex-none rotate-[6.76deg]">
                        <div className="h-[146.994px] relative w-[198.517px]">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup134} />
                        </div>
                      </div>
                    </div>
                    <div className="absolute contents h-[213.418px] left-[2.78px] top-[2.29px] w-[240.255px]" data-node-id="22201:807">
                      <div className="absolute flex h-[15.181px] items-center justify-center left-[97.45px] top-[171.53px] w-[6.87px]" data-node-id="22201:808">
                        <div className="flex-none rotate-[6.76deg]">
                          <div className="bg-[#7e7e7e] h-[14.673px] relative w-[5.179px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[15.181px] items-center justify-center left-[132.59px] top-[175.69px] w-[6.87px]" data-node-id="22201:809">
                        <div className="flex-none rotate-[6.76deg]">
                          <div className="bg-[#7e7e7e] h-[14.673px] relative w-[5.179px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[16.774px] items-center justify-center left-[98.87px] top-[162.1px] w-[41.707px]" data-node-id="22201:810">
                        <div className="flex-none rotate-[6.76deg]">
                          <div className="bg-[#7e7e7e] h-[12.084px] relative w-[40.566px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[138.326px] items-center justify-center left-[116.18px] top-[37.23px] w-[23.156px]" data-node-id="22201:811">
                        <div className="flex-none rotate-[6.76deg]">
                          <div className="bg-[#7e7e7e] h-[138.476px] relative w-[6.905px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[38.626px] items-center justify-center left-[46.04px] top-[141.05px] w-[15.566px]" data-node-id="22201:812">
                        <div className="flex-none rotate-[6.75deg] skew-x-[-0.01deg]">
                          <div className="bg-[#7e7e7e] h-[37.568px] relative w-[11.221px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[38.626px] items-center justify-center left-[178.89px] top-[156.79px] w-[15.566px]" data-node-id="22201:813">
                        <div className="flex-none rotate-[6.75deg] skew-x-[-0.01deg]">
                          <div className="bg-[#7e7e7e] h-[37.568px] relative w-[11.221px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[139.318px] items-center justify-center left-[20.33px] top-[2.29px] w-[222.707px]" data-node-id="22201:814">
                        <div className="flex-none rotate-[13.32deg]">
                          <div className="h-[94.26px] relative w-[206.545px]">
                            <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup139} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute contents h-[182.091px] left-[1463.14px] top-[600.64px] w-[235.333px]" data-node-id="22201:832">
            <div className="absolute flex h-[6.767px] items-center justify-center left-[1479.13px] top-[731.05px] w-[7.53px]" data-node-id="22201:833">
              <div className="flex-none rotate-[6.34deg]">
                <div className="bg-[#7e7e7e] h-[6.042px] relative w-[6.905px]" />
              </div>
            </div>
            <div className="absolute flex h-[8.864px] items-center justify-center left-[1479.13px] top-[728.48px] w-[3.527px]" data-node-id="22201:834">
              <div className="flex-none rotate-[6.34deg]">
                <div className="bg-[#7e7e7e] h-[8.631px] relative w-[2.589px]" />
              </div>
            </div>
            <div className="absolute flex h-[8.102px] items-center justify-center left-[1673.09px] top-[750.02px] w-[4.289px]" data-node-id="22201:835">
              <div className="flex-none rotate-[6.34deg]">
                <div className="bg-[#7e7e7e] h-[7.768px] relative w-[3.452px]" />
              </div>
            </div>
            <div className="absolute flex h-[5.91px] items-center justify-center left-[1669.66px] top-[752.22px] w-[7.435px]" data-node-id="22201:836">
              <div className="flex-none rotate-[6.34deg]">
                <div className="bg-[#7e7e7e] h-[5.179px] relative w-[6.905px]" />
              </div>
            </div>
            <div className="absolute flex h-[15.822px] items-center justify-center left-[1475.22px] top-[718.57px] w-[12.772px]" data-node-id="22201:837">
              <div className="flex-none rotate-[6.34deg]">
                <div className="bg-[#7e7e7e] h-[14.673px] relative w-[11.221px]" />
              </div>
            </div>
            <div className="absolute flex h-[15.822px] items-center justify-center left-[1669.95px] top-[740.21px] w-[12.772px]" data-node-id="22201:838">
              <div className="flex-none rotate-[6.34deg]">
                <div className="bg-[#7e7e7e] h-[14.673px] relative w-[11.221px]" />
              </div>
            </div>
            <div className="absolute flex h-[139.234px] items-center justify-center left-[1478.02px] top-[629.74px] w-[210.341px]" data-node-id="22201:839">
              <div className="flex-none rotate-[6.34deg]">
                <div className="h-[118.031px] relative w-[198.52px]">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup135} />
                </div>
              </div>
            </div>
            <div className="absolute flex h-[178.649px] items-center justify-center left-[1465.72px] top-[602.36px] w-[230.16px]" data-node-id="22201:850">
              <div className="flex-none rotate-[12.9deg]">
                <div className="h-[136.337px] relative w-[204.887px]">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup136} />
                </div>
              </div>
            </div>
          </div>
          <div className="absolute flex h-[73.932px] items-center justify-center left-[1085.9px] top-[536.65px] w-[171.151px]" data-node-id="22201:867">
            <div className="flex-none rotate-[8.77deg]">
              <div className="h-[49.264px] relative w-[165.575px]">
                <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup140} />
              </div>
            </div>
          </div>
          <div className="absolute flex h-[70.112px] items-center justify-center left-[1265.5px] top-[541.01px] w-[143.326px]" data-node-id="22201:877">
            <div className="-scale-y-100 flex-none rotate-[171.23deg]">
              <div className="h-[49.754px] relative w-[137.346px]">
                <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup141} />
              </div>
            </div>
          </div>
          <div className="absolute bg-[#7e7e7e] h-[62.144px] left-[1254.27px] top-[595.46px] w-[15.536px]" data-node-id="22201:887" />
          <div className="absolute flex h-[88.36px] items-center justify-center left-[1438.87px] top-[689.4px] w-[157.779px]" data-node-id="22201:888">
            <div className="-scale-y-100 flex-none rotate-[161.42deg]">
              <div className="h-[42.006px] relative w-[152.335px]">
                <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup143} />
              </div>
            </div>
          </div>
          <div className="absolute contents left-[1355.25px] top-[319px]" data-node-id="22201:898">
            <div className="absolute flex items-center justify-center left-[1559.33px] size-[155.17px] top-[820.96px]" data-node-id="22201:899">
              <div className="flex-none rotate-45">
                <div className="h-[20.981px] relative w-[198.462px]">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup146} />
                </div>
              </div>
            </div>
            <div className="absolute flex items-center justify-center left-[1414.32px] size-[163.431px] top-[820.18px]" data-node-id="22201:903">
              <div className="flex-none rotate-135">
                <div className="h-[22.099px] relative w-[209.028px]">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup147} />
                </div>
              </div>
            </div>
            <div className="absolute flex h-[128.983px] items-center justify-center left-[1560.4px] top-[831.06px] w-[46.87px]" data-node-id="22201:907">
              <div className="-scale-y-100 flex-none rotate-75">
                <div className="h-[13.729px] relative w-[129.854px]">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup148} />
                </div>
              </div>
            </div>
            <div className="absolute flex h-[337.202px] items-center justify-center left-[1561.43px] top-[571.56px] w-[12.431px]" data-node-id="22201:911">
              <div className="-scale-y-100 flex-none rotate-90">
                <div className="bg-[#7e7e7e] h-[12.431px] relative w-[337.202px]" />
              </div>
            </div>
            <div className="absolute flex h-[125.553px] items-center justify-center left-[1355.25px] top-[319px] w-[279.856px]" data-node-id="22201:912">
              <div className="flex-none transform-[matrix(-1,_0,_0,_1,_0,_0)]">
                <div className="h-[125.553px] relative w-[279.856px]" data-motion-for="22201:912">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup149} />
                </div>
              </div>
            </div>
            <div className="absolute flex h-[102.559px] items-center justify-center left-[1561.43px] top-[463.56px] w-[12.431px]" data-node-id="22201:915">
              <div className="-scale-y-100 flex-none rotate-90">
                <div className="bg-[#b9b9b9] h-[12.431px] relative w-[102.559px]" />
              </div>
            </div>
            <div className="absolute flex h-[129.753px] items-center justify-center left-[1557.55px] top-[556.02px] w-[20.201px]" data-node-id="22201:916">
              <div className="-scale-y-100 flex-none rotate-90">
                <div className="bg-[#2b2b2b] h-[20.201px] relative rounded-[10px] w-[129.753px]" />
              </div>
            </div>
            <div className="absolute flex h-[56.016px] items-center justify-center left-[1494.39px] top-[392.85px] w-[10.325px]" data-node-id="22201:917">
              <div className="-scale-y-100 flex-none rotate-[83.36deg]">
                <div className="bg-[#7e7e7e] h-[3.885px] relative w-[55.941px]" />
              </div>
            </div>
            <div className="absolute flex h-[31.164px] items-center justify-center left-[1502.42px] top-[442.58px] w-[189.327px]" data-node-id="22201:918">
              <div className="-scale-y-100 flex-none rotate-[7.1deg]">
                <div className="bg-[#7e7e7e] h-[7.77px] relative w-[189.822px]" />
              </div>
            </div>
            <div className="absolute flex h-[24.086px] items-center justify-center left-[1554.44px] top-[442.58px] w-[26.417px]" data-node-id="22201:919">
              <div className="-scale-y-100 flex-none rotate-90">
                <div className="bg-[#343434] h-[26.417px] relative rounded-[10px] w-[24.086px]" />
              </div>
            </div>
            <div className="absolute flex h-[20.201px] items-center justify-center left-[1491.5px] top-[432.48px] w-[21.755px]" data-node-id="22201:920">
              <div className="-scale-y-100 flex-none rotate-90">
                <div className="bg-[#7e7e7e] h-[21.755px] relative rounded-[10px] w-[20.201px]" />
              </div>
            </div>
            <div className="absolute flex h-[35.315px] items-center justify-center left-[1564.04px] top-[871.46px] w-[57.218px]" data-node-id="22201:921">
              <div className="-scale-y-100 flex-none rotate-[152.03deg]">
                <div className="bg-[#7e7e7e] h-[7.77px] relative w-[60.661px]" />
              </div>
            </div>
            <div className="absolute flex h-[35.315px] items-center justify-center left-[1514.31px] top-[871.46px] w-[57.218px]" data-node-id="22201:922">
              <div className="flex-none rotate-[27.97deg]">
                <div className="bg-[#7e7e7e] h-[7.77px] relative w-[60.661px]" />
              </div>
            </div>
            <div className="absolute flex h-[25.081px] items-center justify-center left-[1564.16px] top-[877.53px] w-[18.859px]" data-node-id="22201:923">
              <div className="flex-none rotate-[-60.3deg]">
                <div className="bg-[#7e7e7e] h-[7.77px] relative w-[24.442px]" />
              </div>
            </div>
          </div>
          <div className="absolute flex h-[221.45px] items-center justify-center left-[1488.08px] top-[835.55px] w-[75.868px]" data-node-id="22201:924">
            <div className="-scale-y-100 flex-none rotate-75">
              <div className="h-[18.437px] relative w-[224.321px]">
                <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup144} />
              </div>
            </div>
          </div>
          <div className="absolute h-[27.62px] left-[1243.48px] top-[579.06px] w-[37.114px]" data-node-id="22201:928">
            <div className="absolute inset-[0_2.64%_0_2.38%]">
              <img draggable={false} alt="" className="block max-w-none size-full" src={imgRectangle458} />
            </div>
          </div>
          <div className="absolute h-[405.674px] left-[1080.78px] top-[633.44px] w-[441.787px]" data-node-id="22201:929">
            <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup132} />
          </div>
          <div className="absolute h-[272.4808499076262px] left-[818.39px] overflow-visible top-[613.32px] w-[252.99229076154643px]" data-node-id="22201:939">
            <div className="flex items-center justify-center relative size-full">
              <div className="flex-none h-[254.46914672851562px] transform-[matrix(0.9967296123504639,_-0.08080872893333435,_0.08080872893333435,_0.9967296123504639,_0,_0)] w-[233.19158935546875px]">
                <div className="relative size-full" data-motion-for="22201:939">
                  <div className="h-[254.46914672851562px] origin-[0_0] transform-[matrix(0.9967296414468689,_0.08080873129229257,_-0.08080873129229257,_0.9967296414468689,_1.522752939185807,_-18.78228957211104)] w-[233.19158935546875px]">
                    <div className="absolute flex h-[6.58px] items-center justify-center left-[42.67px] top-[241.81px] w-[7.371px]" data-node-id="22201:940">
                      <div className="flex-none rotate-[-4.64deg]">
                        <div className="bg-[#7e7e7e] h-[6.042px] relative w-[6.905px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[8.812px] items-center justify-center left-[42.46px] top-[239.57px] w-[3.279px]" data-node-id="22201:941">
                      <div className="flex-none rotate-[-4.64deg]">
                        <div className="bg-[#7e7e7e] h-[8.631px] relative w-[2.589px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[8.022px] items-center justify-center left-[236.88px] top-[223.73px] w-[4.069px]" data-node-id="22201:942">
                      <div className="flex-none rotate-[-4.64deg]">
                        <div className="bg-[#7e7e7e] h-[7.768px] relative w-[3.452px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[5.72px] items-center justify-center left-[233.65px] top-[226.31px] w-[7.301px]" data-node-id="22201:943">
                      <div className="flex-none rotate-[-4.64deg]">
                        <div className="bg-[#7e7e7e] h-[5.179px] relative w-[6.905px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[91.275px] items-center justify-center left-[31.25px] top-[154.02px] w-[18.511px]" data-node-id="22201:944">
                      <div className="flex-none rotate-[-4.65deg] skew-x-[-0.02deg]">
                        <div className="bg-[#7e7e7e] h-[90.661px] relative w-[11.221px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[91.275px] items-center justify-center left-[226.53px] top-[138.12px] w-[18.511px]" data-node-id="22201:945">
                      <div className="flex-none rotate-[-4.65deg] skew-x-[-0.02deg]">
                        <div className="bg-[#7e7e7e] h-[90.661px] relative w-[11.221px]" />
                      </div>
                    </div>
                    <div className="absolute flex h-[222.588px] items-center justify-center left-[27.21px] top-[35.82px] w-[214.624px]" data-node-id="22201:946">
                      <div className="flex-none rotate-[-4.64deg]">
                        <div className="h-[207.214px] relative w-[198.518px]">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup137} />
                        </div>
                      </div>
                    </div>
                    <div className="absolute contents h-[239.081px] left-[18.64px] top-[16.7px] w-[215.707px]" data-node-id="22201:950">
                      <div className="absolute flex h-[15.044px] items-center justify-center left-[120.91px] top-[232.9px] w-[6.348px]" data-node-id="22201:951">
                        <div className="flex-none rotate-[-4.64deg]">
                          <div className="bg-[#7e7e7e] h-[14.673px] relative w-[5.179px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[15.044px] items-center justify-center left-[156.18px] top-[230.04px] w-[6.348px]" data-node-id="22201:952">
                        <div className="flex-none rotate-[-4.64deg]">
                          <div className="bg-[#7e7e7e] h-[14.673px] relative w-[5.179px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[15.324px] items-center justify-center left-[120.14px] top-[220.58px] w-[41.411px]" data-node-id="22201:953">
                        <div className="flex-none rotate-[-4.64deg]">
                          <div className="bg-[#7e7e7e] h-[12.084px] relative w-[40.566px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[147.169px] items-center justify-center left-[126.33px] top-[85.95px] w-[18.777px]" data-node-id="22201:954">
                        <div className="flex-none rotate-[-4.64deg]">
                          <div className="bg-[#7e7e7e] h-[147.093px] relative w-[6.905px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[62.057px] items-center justify-center left-[65.21px] top-[188.47px] w-[16.142px]" data-node-id="22201:955">
                        <div className="flex-none rotate-[-4.65deg] skew-x-[-0.01deg]">
                          <div className="bg-[#7e7e7e] h-[61.349px] relative w-[11.221px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[62.057px] items-center justify-center left-[198.56px] top-[177.63px] w-[16.142px]" data-node-id="22201:956">
                        <div className="flex-none rotate-[-4.65deg] skew-x-[-0.01deg]">
                          <div className="bg-[#7e7e7e] h-[61.349px] relative w-[11.221px]" />
                        </div>
                      </div>
                      <div className="absolute flex h-[115.763px] items-center justify-center left-[22.79px] top-[16.7px] w-[211.562px]" data-node-id="22201:957">
                        <div className="flex-none rotate-[1.92deg]">
                          <div className="h-[108.837px] relative w-[208.023px]">
                            <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup142} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute flex h-[221.449px] items-center justify-center left-[1041.08px] top-[835.14px] w-[75.868px]" data-node-id="22201:975">
            <div className="-scale-y-100 flex-none rotate-105">
              <div className="h-[18.437px] relative w-[224.321px]">
                <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup145} />
              </div>
            </div>
          </div>
          <div className="absolute flex h-[96.137px] items-center justify-center left-[937.63px] top-[765.09px] w-[160.946px]" data-node-id="22201:979">
            <div className="flex-none rotate-[18.58deg]">
              <div className="h-[49.989px] relative w-[152.992px]">
                <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup150} />
              </div>
            </div>
          </div>
          <div className="absolute contents left-[638px] top-[363.02px]" data-node-id="22201:989">
            <div className="absolute flex items-center justify-center left-[638px] size-[162.828px] top-[863.18px]" data-node-id="22201:990">
              <div className="-scale-y-100 flex-none rotate-135">
                <div className="h-[22.017px] relative w-[208.257px]">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup151} />
                </div>
              </div>
            </div>
            <div className="absolute flex items-center justify-center left-[781.5px] size-[171.497px] top-[862.37px]" data-node-id="22201:994">
              <div className="-scale-y-100 flex-none rotate-45">
                <div className="h-[23.189px] relative w-[219.344px]">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup153} />
                </div>
              </div>
            </div>
            <div className="absolute flex h-[135.349px] items-center justify-center left-[750.51px] top-[873.78px] w-[49.183px]" data-node-id="22201:998">
              <div className="flex-none rotate-105">
                <div className="h-[14.406px] relative w-[136.264px]">
                  <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup154} />
                </div>
              </div>
            </div>
            <div className="absolute flex h-[353.843px] items-center justify-center left-[785.57px] top-[601.47px] w-[13.045px]" data-node-id="22201:1002">
              <div className="flex-none rotate-90">
                <div className="bg-[#7e7e7e] h-[13.045px] relative w-[353.843px]" />
              </div>
            </div>
            <div className="absolute h-[79.303px] left-[680.29px] top-[363.02px] w-[368.35px]" data-node-id="22201:1003">
              <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup155} />
            </div>
            <div className="absolute flex h-[107.621px] items-center justify-center left-[785.57px] top-[488.14px] w-[13.045px]" data-node-id="22201:1006">
              <div className="flex-none rotate-90">
                <div className="bg-[#b9b9b9] h-[13.045px] relative w-[107.621px]" />
              </div>
            </div>
            <div className="absolute flex h-[136.156px] items-center justify-center left-[781.5px] top-[585.16px] w-[21.198px]" data-node-id="22201:1007">
              <div className="flex-none rotate-90">
                <div className="bg-[#2b2b2b] h-[21.198px] relative rounded-[10px] w-[136.156px]" />
              </div>
            </div>
            <div className="absolute flex h-[58.78px] items-center justify-center left-[858.14px] top-[413.95px] w-[10.835px]" data-node-id="22201:1008">
              <div className="flex-none rotate-[96.64deg]">
                <div className="bg-[#7e7e7e] h-[4.077px] relative w-[58.702px]" />
              </div>
            </div>
            <div className="absolute flex h-[32.702px] items-center justify-center left-[661.88px] top-[466.13px] w-[198.671px]" data-node-id="22201:1009">
              <div className="flex-none rotate-[172.9deg]">
                <div className="bg-[#7e7e7e] h-[8.153px] relative w-[199.19px]" />
              </div>
            </div>
            <div className="absolute flex h-[25.275px] items-center justify-center left-[778.24px] top-[466.13px] w-[27.72px]" data-node-id="22201:1010">
              <div className="flex-none rotate-90">
                <div className="bg-[#343434] h-[27.72px] relative rounded-[10px] w-[25.275px]" />
              </div>
            </div>
            <div className="absolute flex h-[21.198px] items-center justify-center left-[849.17px] top-[455.53px] w-[22.829px]" data-node-id="22201:1011">
              <div className="flex-none rotate-90">
                <div className="bg-[#7e7e7e] h-[22.829px] relative rounded-[10px] w-[21.198px]" />
              </div>
            </div>
            <div className="absolute flex h-[37.058px] items-center justify-center left-[735.84px] top-[916.18px] w-[60.042px]" data-node-id="22201:1012">
              <div className="flex-none rotate-[27.97deg]">
                <div className="bg-[#7e7e7e] h-[8.153px] relative w-[63.655px]" />
              </div>
            </div>
            <div className="absolute flex h-[37.058px] items-center justify-center left-[788.02px] top-[916.18px] w-[60.042px]" data-node-id="22201:1013">
              <div className="-scale-y-100 flex-none rotate-[152.03deg]">
                <div className="bg-[#7e7e7e] h-[8.153px] relative w-[63.655px]" />
              </div>
            </div>
            <div className="absolute flex h-[26.318px] items-center justify-center left-[775.96px] top-[922.54px] w-[19.789px]" data-node-id="22201:1014">
              <div className="-scale-y-100 flex-none rotate-[-119.7deg]">
                <div className="bg-[#7e7e7e] h-[8.153px] relative w-[25.648px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function KeyboardShark() {
  return (
    <div className="relative h-[708px] w-[751.175px] overflow-visible" data-shark-member="keyboard">
      <div className="left-0 top-0 absolute h-[708px] w-[751.175px]" data-node-id="20488:51399">
        <div className="absolute h-[541.3437555804776px] left-[91.87px] overflow-visible top-[94.55px] w-[641.0722291562088px]" data-node-id="20488:51378">
          <div className="flex items-center justify-center relative size-full">
            <div className="flex-none h-[423.8360595703125px] transform-[matrix(0.9729466438293457,_0.2310299575328827,_-0.2310299575328827,_0.9729466438293457,_0,_0)] w-[558.256103515625px]">
              <div className="relative size-full" data-motion-for="20488:51378">
                <div className="h-[423.8360595703125px] origin-[0_0] transform-[matrix(0.9729466311650509,_-0.23102995452569672,_0.23102995452569672,_0.9729466311650509,_-95.2697927049527,_22.622182112848037)] w-[558.256103515625px]">
                  <div className="absolute flex h-[116.288px] items-center justify-center left-[354.02px] top-[269.51px] w-[110.55px]" data-node-id="20488:51379">
                    <div className="flex-none transform-[matrix(0.9208818371752479,_-0.3898418652637563,_0.3898418652637563,_0.9208818371752479,_0,_0)]">
                      <div className="h-[91.935px] relative w-[81.129px]" data-motion-for="20488:51379">
                        <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector65} />
                      </div>
                    </div>
                  </div>
                  <div className="absolute contents h-[510.291px] left-[1.11px] top-0 w-[528.926px]" data-node-id="20488:51400">
                    <div className="absolute flex h-[491.021px] items-center justify-center left-[9.17px] top-[7.84px] w-[497.727px]" data-node-id="20488:51381">
                      <div className="flex-none rotate-[18.41deg]">
                        <div className="h-[385.626px] relative w-[396.22px]">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector44} />
                        </div>
                      </div>
                    </div>
                    <div className="absolute flex h-[259.25px] items-center justify-center left-[253.51px] top-[157.07px] w-[245.181px]" data-node-id="20488:51382">
                      <div className="flex-none transform-[matrix(-0.8922802585267413,_-0.45148165963314035,_-0.45148165963314035,_0.8922802585267413,_0,_0)]">
                        <div className="h-[203.653px] relative w-[171.734px]" data-motion-for="20488:51382">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector45} />
                        </div>
                      </div>
                    </div>
                    <div className="absolute flex h-[32.688px] items-center justify-center left-[269.09px] top-[201.33px] w-[32.696px]" data-node-id="20488:51383">
                      <div className="flex-none transform-[matrix(-0.5766880928260321,_-0.8169644961948919,_-0.8171167710964795,_0.5764723144109105,_0,_0)]">
                        <div className="h-[23.457px] relative w-[23.459px]" data-motion-for="20488:51383">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgEllipse9} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute flex h-[120.118px] items-center justify-center left-[179.22px] top-[336.99px] w-[399.44px]" data-node-id="20488:51384">
                    <div className="flex-none transform-[matrix(0.9862859728214177,_-0.16504556396290937,_0.16504556396290937,_0.9862859728214177,_0,_0)]">
                      <div className="h-[55.572px] relative w-[395.695px]" data-motion-for="20488:51384">
                        <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup117} />
                      </div>
                    </div>
                  </div>
                  <div className="absolute flex h-[103.367px] items-center justify-center left-[188.17px] top-[309.74px] w-[111.709px]" data-node-id="20488:51397">
                    <div className="flex-none transform-[matrix(-0.5947559774741791,_0.8039061708503068,_-0.8039061708503068,_-0.5947559774741791,_0,_0)]">
                      <div className="h-[96.828px] relative w-[56.944px]" data-motion-for="20488:51397">
                        <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector63} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VocalShark() {
  return (
    <div className="relative h-[1051.637px] w-[1052.105px] overflow-visible" data-shark-member="vocal">
      <div className="left-0 top-0 absolute h-[1051.6368579574082px] overflow-visible w-[1052.104613997355px]" data-node-id="22201:1016">
        <div className="flex items-center justify-center relative size-full">
          <div className="flex-none h-[748.257568359375px] transform-[matrix(-0.789455771446228,_0.6138073801994324,_0.6138073801994324,_0.789455771446228,_0,_0)] w-[750.9205932617188px]">
            <div className="relative size-full" data-motion-for="22201:1016">
              <div className="h-[748.257568359375px] origin-[0_0] transform-[matrix(-0.7894558385049362,_0.6138074323380466,_0.6138074323380466,_0.7894558385049362,_468.00410198251245,_-363.87646040540767)] w-[750.9205932617188px]">
                <div className="absolute contents h-[746.166px] left-[151.62px] top-[152.74px] w-[748.86px]" data-node-id="22201:1017">
                  <div className="absolute contents h-[475.233px] left-[285.19px] top-[288.2px] w-[481.728px]" data-node-id="22201:1018">
                    <div className="absolute flex h-[56.64px] items-center justify-center left-[626.05px] top-[569.16px] w-[105.03px]" data-node-id="22201:1019">
                      <div className="flex-none transform-[matrix(0.15006835112149802,_-0.9886756887207239,_0.9886756887207239,_0.15006835112149802,_0,_0)]">
                        <div className="h-[99.837px] relative w-[42.134px]" data-motion-for="22201:1019">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector69} />
                        </div>
                      </div>
                    </div>
                    <div className="absolute contents h-[475.082px] left-[285.26px] top-[288.28px] w-[481.575px]" data-node-id="22201:1020">
                      <div className="absolute flex h-[454.769px] items-center justify-center left-[295.15px] top-[298.43px] w-[461.805px]" data-node-id="22201:1021">
                        <div className="flex-none transform-[matrix(0.9637793665393054,_0.2667007119550513,_-0.2667007119550513,_0.9637793665393054,_0,_0)]">
                          <div className="h-[367.399px] relative w-[377.492px]" data-motion-for="22201:1021">
                            <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector47} />
                          </div>
                        </div>
                      </div>
                      <div className="absolute flex h-[243.674px] items-center justify-center left-[525.92px] top-[429.93px] w-[228.191px]" data-node-id="22201:1022">
                        <div className="flex-none transform-[matrix(-0.9142730783177164,_-0.40509828242723867,_-0.40509828242723867,_0.9142730783177164,_0,_0)]">
                          <div className="h-[194.027px] relative w-[163.617px]" data-motion-for="22201:1022">
                            <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector48} />
                          </div>
                        </div>
                      </div>
                      <div className="absolute flex h-[9.792px] items-center justify-center left-[540.23px] top-[479.92px] w-[28.661px]" data-node-id="22201:1023">
                        <div className="flex-none transform-[matrix(-0.9852198392031914,_-0.17129479908553014,_-0.17129479908553014,_0.9852198392031914,_0,_0)]">
                          <div className="bg-white h-[5.034px] relative rounded-[2px] w-[28.216px]" data-motion-for="22201:1023" />
                        </div>
                      </div>
                    </div>
                    <div className="absolute flex h-[94.397px] items-center justify-center left-[502.67px] top-[572.42px] w-[124.278px]" data-node-id="22201:1024">
                      <div className="flex-none transform-[matrix(0.41826868615195467,_0.9083232914268268,_-0.9083232914268268,_0.41826868615195467,_0,_0)]">
                        <div className="h-[112.907px] relative w-[51.933px]" data-motion-for="22201:1024">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector70} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute flex h-[125.288px] items-center justify-center left-[669.53px] top-[519.23px] w-[93.934px]" data-node-id="22201:1025">
                  <div className="flex-none transform-[matrix(-0.8827718855000972,_0.4698017671983603,_0.4698017671983603,_0.8827718855000972,_0,_0)]">
                    <div className="h-[119.001px] relative w-[43.077px]" data-motion-for="22201:1025">
                      <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup130} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BassShark() {
  return (
    <div className="relative h-[667.165px] w-[676.303px] overflow-visible" data-shark-member="bass">
      <div className="left-0 top-0 absolute h-[667.165px] w-[676.303px]" data-node-id="20496:52570">
        <div className="absolute h-[667.1653084112568px] left-0 overflow-visible top-0 w-[676.3027458539527px]" data-node-id="20488:49593">
          <div className="flex items-center justify-center relative size-full">
            <div className="flex-none h-[628.1234741210938px] transform-[matrix(0.9980027675628662,_-0.06317052245140076,_0.06317052245140076,_0.9980027675628662,_0,_0)] w-[637.8978881835938px]">
              <div className="relative size-full" data-motion-for="20488:49593">
                <div className="h-[628.1234741210938px] origin-[0_0] transform-[matrix(0.9980027286707764,_0.06317051998965044,_-0.06317051998965044,_0.9980027286707764,_2.545541051986973,_-40.21586202302426)] w-[637.8978881835938px]">
                  <div className="absolute flex h-[101.139px] items-center justify-center left-[144.77px] top-[276.53px] w-[78.607px]" data-node-id="20488:49594">
                    <div className="-scale-y-100 flex-none rotate-[159.79deg]">
                      <div className="h-[89px] relative w-[51px]">
                        <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup128} />
                      </div>
                    </div>
                  </div>
                  <div className="absolute contents h-[662.028px] left-[2.61px] top-[2.57px] w-[671.074px]" data-node-id="20488:49596">
                    <div className="absolute contents h-[516.804px] left-[82.31px] top-[67.73px] w-[523.566px]" data-node-id="20488:49597">
                      <div className="absolute flex h-[478.607px] items-center justify-center left-[100.9px] top-[86.83px] w-[486.391px]" data-node-id="20488:49598">
                        <div className="-scale-y-100 flex-none rotate-[165.76deg]">
                          <div className="h-[391.674px] relative w-[402.434px]">
                            <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector42} />
                          </div>
                        </div>
                      </div>
                      <div className="absolute flex h-[258.086px] items-center justify-center left-[101.69px] top-[222.13px] w-[240.663px]" data-node-id="20488:49599">
                        <div className="flex-none transform-[matrix(0.9227773077947846,_-0.38533364670430736,_0.38533364670430736,_0.9227773077947846,_0,_0)]">
                          <div className="h-[206.846px] relative w-[174.428px]" data-motion-for="20488:49599">
                            <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector46} />
                          </div>
                        </div>
                      </div>
                      <div className="absolute flex h-[31.73px] items-center justify-center left-[289.73px] top-[262.06px] w-[31.739px]" data-node-id="20488:49600">
                        <div className="flex-none rotate-[-28.04deg] skew-x-[0.02deg]">
                          <div className="h-[23.457px] relative w-[23.459px]">
                            <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgEllipse10} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute flex h-[515.188px] items-center justify-center left-[47.34px] top-[134.42px] w-[597.176px]" data-node-id="20488:49601">
                      <div className="flex-none rotate-[-32.07deg]">
                        <div className="h-[273.944px] relative w-[533.073px]">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup112} />
                        </div>
                      </div>
                    </div>
                    <div className="absolute flex h-[110.682px] items-center justify-center left-[148.42px] top-[361.81px] w-[112.592px]" data-node-id="20488:49695">
                      <div className="flex-none transform-[matrix(0.9265523179563426,_0.37616594608830894,_-0.37616594608830894,_0.9265523179563426,_0,_0)]">
                        <div className="h-[83.96px] relative w-[87.43px]" data-motion-for="20488:49695">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector66} />
                        </div>
                      </div>
                    </div>
                    <div className="-translate-x-1/2 absolute flex h-[113.01px] items-center justify-center left-[calc(50%+66.41px)] top-[339.99px] w-[91.141px]" data-node-id="20488:49696">
                      <div className="flex-none transform-[matrix(0.9234823671559437,_0.3836404762422275,_-0.3836404762422275,_0.9234823671559437,_0,_0)]">
                        <div className="h-[98.347px] relative w-[57.837px]" data-motion-for="20488:49696">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector67} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute flex h-[46.831px] items-center justify-center left-[296.51px] top-[225.74px] w-[68.132px]" data-node-id="20488:49697">
                    <div className="flex-none rotate-[-3.62deg]">
                      <div className="h-[42.775px] relative w-[65.561px]">
                        <div className="absolute inset-[-0.21%_-0.29%_-0.28%_0]">
                          <img draggable={false} alt="" className="block max-w-none size-full" src={imgVector68} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute flex h-[89.598px] items-center justify-center left-[334.57px] top-[262.5px] w-[57.938px]" data-node-id="20488:49698">
                    <div className="flex-none rotate-[0.61deg]">
                      <div className="h-[89px] relative w-[57px]">
                        <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup127} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuitarShark() {
  return (
    <div className="relative h-[713.378px] w-[724.19px] overflow-visible" data-shark-member="guitar">
      <div className="left-0 top-0 absolute h-[713.378px] w-[724.19px]" data-node-id="20488:50016">
        <div className="absolute h-[713.3783658151506px] left-0 overflow-visible top-0 w-[724.1899586922536px]" data-node-id="20488:49448">
          <div className="flex items-center justify-center relative size-full">
            <div className="flex-none h-[582.9757080078125px] transform-[matrix(0.96858149766922,_0.2486961930990219,_-0.2486961930990219,_0.96858149766922,_0,_0)] w-[597.9942016601562px]">
              <div className="relative size-full" data-motion-for="20488:49448">
                <div className="h-[582.9757080078125px] origin-[0_0] transform-[matrix(0.9685815808809399,_-0.24869621446473872,_0.24869621446473872,_0.9685815808809399,_-140.42867786216388,_36.0569324009284)] w-[597.9942016601562px]">
                  <div className="absolute contents h-[656.921px] left-[31.69px] top-[24.03px] w-[660.395px]" data-node-id="20488:49449">
                    <div className="absolute flex h-[442.372px] items-center justify-center left-[136.1px] top-[131.3px] w-[451.582px]" data-node-id="20488:49450">
                      <div className="-scale-y-100 flex-none rotate-[-172.25deg]">
                        <div className="h-[391.674px] relative w-[402.434px]">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector42} />
                        </div>
                      </div>
                    </div>
                    <div className="absolute flex h-[208.897px] items-center justify-center left-[150.89px] top-[225.56px] w-[176.864px]" data-node-id="20488:49451">
                      <div className="flex-none transform-[matrix(0.9999298971165077,_-0.011836718288708803,_0.011836718288708803,_0.9999298971165077,_0,_0)]">
                        <div className="h-[206.846px] relative w-[174.428px]" data-motion-for="20488:49451">
                          <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector43} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute flex h-[362.899px] items-center justify-center left-[62px] top-[229.99px] w-[572.065px]" data-node-id="20488:49452">
                    <div className="flex-none transform-[matrix(0.9845596708074447,_-0.17504917917562057,_0.17504917917562057,_0.9845596708074447,_0,_0)]">
                      <div className="h-[273.944px] relative w-[532.331px]" data-motion-for="20488:49452">
                        <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgGroup111} />
                      </div>
                    </div>
                  </div>
                  <div className="absolute flex h-[122.252px] items-center justify-center left-[145px] top-[308px] w-[118.349px]" data-node-id="20488:49566">
                    <div className="flex-none transform-[matrix(0.8621801120932293,_0.5066018698199919,_-0.5066018698199919,_0.8621801120932293,_0,_0)]">
                      <div className="h-[93.376px] relative w-[82.401px]" data-motion-for="20488:49566">
                        <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector64} />
                      </div>
                    </div>
                  </div>
                  <div className="absolute flex h-[114.044px] items-center justify-center left-[308px] top-[391px] w-[101.284px]" data-node-id="20488:49567">
                    <div className="flex-none transform-[matrix(-0.8468450116951693,_0.5318395026299134,_0.5318395026299134,_0.8468450116951693,_0,_0)]">
                      <div className="h-[98.347px] relative w-[57.837px]" data-motion-for="20488:49567">
                        <img draggable={false} alt="" className="absolute block inset-0 max-w-none size-full" src={imgVector62} />
                      </div>
                    </div>
                  </div>
                  <div className="absolute flex h-[9.774px] items-center justify-center left-[318.39px] top-[278.76px] w-[30.543px]" data-node-id="20488:49568">
                    <div className="flex-none transform-[matrix(0.9889119796487962,_-0.148502410796147,_0.148502410796147,_0.9889119796487962,_0,_0)]">
                      <div className="bg-white h-[5.366px] relative rounded-[2px] w-[30.08px]" data-motion-for="20488:49568" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderMember(member: SharkMember): ReactNode {
  switch (member) {
    case "drummer":
      return <DrummerShark />;
    case "keyboard":
      return <KeyboardShark />;
    case "vocal":
      return <VocalShark />;
    case "bass":
      return <BassShark />;
    case "guitar":
      return <GuitarShark />;
  }
}

export function SharkBandLoader({ member }: { member?: SharkMember }) {
  const [pickedMember] = useState<SharkMember>(() => member ?? pickNextSharkMember());
  const activeMember = member ?? pickedMember;
  const spec = SHARK_MEMBER_SPECS[activeMember];
  const renderedWidth = spec.inkWidth * spec.scale;
  const renderedHeight = spec.inkHeight * spec.scale;

  return (
    <div
      className="shark-loading-stage relative flex h-[144px] w-[176px] shrink-0 items-center justify-center overflow-visible select-none"
      aria-hidden="true"
    >
      <div className="shark-band-loader relative flex size-full items-center justify-center overflow-visible">
        <div
          className="pointer-events-none relative overflow-visible"
          style={{ width: renderedWidth, height: renderedHeight }}
        >
          <div
            className="origin-top-left"
            style={{
              transform: `scale(${spec.scale}) translate(${-spec.inkLeft}px, ${-spec.inkTop}px)`,
            }}
          >
            {renderMember(activeMember)}
          </div>
        </div>
      </div>
    </div>
  );
}
