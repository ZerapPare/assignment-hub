# Advertisement Display Sequence

The client requests one randomly selected active advertisement when the user starts a Classroom sync or automatic schedule generation. If one is available, the popup loads its uploaded image and links to the configured destination; these requests run independently of the sync or scheduling operation.

<!-- mermaid-checked: every participant uses `participant Id as "Label"`, no \n in aliases/messages/notes, every alt/opt/loop closed by end, no `:` inside any alias -->
~~~mermaid
sequenceDiagram
    participant User as "ผู้ใช้"
    participant Page as "หน้า Home หรือ Schedule"
    participant Popup as "หน้าต่างโฆษณา"
    participant API as "Ads API"
    participant DB as "ฐานข้อมูล"
    participant Files as "ที่เก็บรูปโฆษณา"
    participant Browser as "เบราว์เซอร์"
    participant Target as "เว็บไซต์ปลายทาง"

    alt ผู้ใช้กดซิงก์งานหรือจัดตารางงาน
        User->>Page: เริ่มซิงก์หรือสร้างตาราง
        Page-)API: GET /api/ads/random
        Note over Page,API: คำขอโฆษณาทำงานแยกจากการทำงานหลัก
        API->>DB: สุ่มเลือกโฆษณาที่เปิดใช้งาน
        alt พบโฆษณาที่เปิดใช้งาน
            DB-->>API: ข้อมูลชื่อ ลิงก์ และรหัสรูป
            API-->>Page: ข้อมูลโฆษณาและ URL รูป
            Page->>Popup: เปิด popup ด้วยโฆษณาที่เลือก
            Popup-->>Browser: แสดงชื่อโฆษณาและป้าย Sponsored
            Browser->>API: GET /api/ads/images/{filename}
            API->>Files: อ่านไฟล์รูปจาก static route
            Files-->>API: ส่งข้อมูลรูปภาพ
            API-->>Browser: ส่งไฟล์รูปภาพ
            Browser-->>User: แสดง popup พร้อมรูป
            alt ผู้ใช้ปิด popup
                User->>Popup: กดปิดหรือคลิกพื้นหลัง
                Popup-->>Page: เรียก callback ปิด
                Page-->>User: ซ่อน popup
            else ผู้ใช้คลิกลิงก์โฆษณา
                User->>Browser: คลิกรูปโฆษณา
                Browser-)Target: เปิดลิงก์ในแท็บใหม่
                Target-->>Browser: แสดงหน้าเว็บไซต์ปลายทาง
            end
        else ไม่มีโฆษณาที่เปิดใช้งาน
            DB-->>API: ไม่พบรายการโฆษณา
            API-->>Page: null
            Page-->>User: ไม่แสดง popup และทำงานหลักต่อ
        end
    end
~~~
