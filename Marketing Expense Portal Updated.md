**Marketing Spend Portal**  
*One place to request, approve, track and reconcile every marketing expense at InfoBeans.* 

High level summary of what does this application will look like:  
**“ InfoBeans Marketing Spend Portal is an internal platform where employees create marketing initiatives and add individual spend requests under them. Each spend request captures the amount, category, business justification and supporting documents and is sent to Siddharth for approval. CEO (Siddharth Sethi) can approve the requested amount, approve a different amount, reject it, request changes or comment. All expenses remain grouped under their initiative, giving both the employee and leadership a complete view of the activity and its associated spend. “**

System view:   
1\. Employee side:  
Login → New Spend Request → Select Category → Fill Details → Attachments (if any) → Submit → Track Status 

2\. Siddharth’s side:   
Login → Dashboard → Pending Requests → Open Request → Review → Comment / Approve / Reject / Request Changes 

3\. If approved:   
Approved → Spend happens → Invoice/Receipt uploaded → Actual spend recorded → Closed 

Dashboard \- list all expense occurred so far in current fiscal, sort/list by head/requester

Users and Personas: 

* Employee/requester  
* Siddharth / executive approver  
* Marketing/admin  
* Finance \- to track INvoice, bills, PO

**How will the form look for an employee?**   
So eventually an employee would sign in using InfoBeans SSO, then see list of requests made and approval status, make new request. For new request creation \- the high level categories appear and then the form dynamically asks relevant questions**.**

**Categories:** 

* Conference / Event  
* Sponsorship  
* Advertising  
* Travel  
* Customer / Prospect Event  
* Content & Creative  
* Branding / Merchandise  
* PR  
* Digital Marketing  
* Software / Marketing Tools  
* Website / Digital Presence  
* Partner Marketing  
* Sales & Marketing Collateral  
* Gifts / Hospitality  
* Research / Analyst Relations  
* Other

**FORM:** 

1. **Basic Information:** Category, subcategories, Request title, Purpose, Vendor, Initiative, Expected date, duration.   
2. **Money :** Estimated amount , Tax, Payment method, Expected Spend ( breakdown)   
3. **Business Justification :** Why, what is the expected outcome?   
4. **Supporting Docs (if any)**   
   

**For every request we will maintain an audit trail:**   
For example:   
 Sept 2, 4:31 PM — request Submitted by Paarth  
 Sept 2, 4:32 PM — Notification sent to Siddharth  
 Sept 2, 5:10 PM — Siddharth requested changes  
 Sept 3, 10:04 AM — Paarth resubmitted  
 Sept 3, 11:21 AM — Siddharth approved ₹2,00,000

| Category | Spend Types / Examples |
| ----- | ----- |
| **A. Conferences & Events** | **Conference registration; Delegate passes; Speaker registration; Booth / exhibition space; Sponsorship package; Speaking slot; Event branding; Banner; Backdrop; Booth construction; AV equipment; Event collateral; Swag; Shipping; Event staff; Hospitality; Customer dinner; Networking event; Side event; Event photography / video** |
| **B. Advertising & Paid Promotion** | **Google Ads; LinkedIn Ads; Meta Ads; YouTube Ads; Display advertising; Retargeting; Sponsored content; Newsletter sponsorship; Industry publication advertising; Marketplace advertising; Job-board advertising (marketing-related); Campaign-specific paid promotion** |
| **C. Content & Creative** | **Video production; Product videos; Explainer videos; Photography; Graphic design; Motion graphics; Copywriting; Blog / content production; Case studies; Whitepapers; eBooks; Brochures; Infographics; Creative agencies; Freelancers** |
| **D. Branding & Merchandise** | **T-shirts; Hoodies; Caps; Bags; Pens; Notebooks; Mugs; Corporate gifts; Conference giveaways; Printed materials; Banners; Standees; Office branding; Event branding** |
| **E. Travel & Accommodation** | **Flights; Hotels; Local transportation; Airport transfers; Car rental; Meals; Per diem; Visa; Travel insurance; Conference-related travel** |
| **F. Customer / Prospect Engagement** | **Customer dinners; Executive dinners; Client events; Prospect events; Hospitality; Networking events; Customer gifts; Prospect gifts; Entertainment; Roundtables; Workshops; Executive briefings** |
| **G. Digital Marketing** | **SEO; SEM; Website campaigns; Landing pages; Email campaigns; Marketing automation; Social media campaigns; nfluencer marketing; Affiliate marketing; Online directories; Review platforms** |
| **H. Marketing Technology** | **Marketing SaaS; Analytics tools; SEO tools; Email platforms; CRM-related marketing tools; Social media tools; Content management tools; Design tools; Video tools; Webinar platforms; Lead-generation platforms; Data providers; Marketing AI tools** |
| **I. PR & Communications** | **PR agency; Press releases; Media outreach; Journalist engagement; Media monitoring; PR campaigns; Awards; Award submissions; Industry publications; Thought leadership** |
| **J. Analyst / Industry Relations** | **Analyst subscriptions; Analyst briefings; Research reports; Analyst events; Industry memberships; Industry associations; Research studies** |
| **K. Partnerships & Co-Marketing** | **Partner events; Joint campaigns; Co-branded campaigns; Partner sponsorship; MDF-related expenditure; Partner collateral; Partner webinars; Partner content** |
| **L. Website & Digital Presence** | **Website development specifically for marketing; Landing pages; Domain purchases; Hosting; CDN; Website plugins; Design; Conversion optimization; Tracking / analytics** |
| **M. Awards & Recognition** | **Award entry fees; Submission fees; Award sponsorship; Award ceremony tickets; Creative production; PR around award wins** |
| **N. Research & Intelligence** | **Market research; Customer research; Surveys; Industry reports; Competitive intelligence; Research agencies; Data purchases** |
| **O. Memberships & Associations** | **Industry memberships; Professional associations; Chamber memberships; Marketing organizations; Conference memberships** |
| **P. Internal Marketing Initiatives** | **Internal campaigns; Employer branding; Internal events; Employee advocacy; Internal promotional material; Recruitment marketing** |
| **Q. Other** | **Other Marketing Spend — Description required** |

# **Marketing Spend Portal**

### **Requirements Specification Document**

**InfoBeans Technologies Ltd.**

**Purpose: One place to request, approve, track and reconcile every marketing expense at InfoBeans.**

---

## **1\. Executive Summary**

**The InfoBeans Marketing Spend Portal will be an internal platform to manage the complete lifecycle of marketing expenditure.**

**Employees will create marketing initiatives and raise individual spend requests against those initiatives. Each request will capture the spend category, purpose, business justification, estimated cost, expected outcome and supporting documentation.**

**The request will be routed to Siddharth Sethi (CEO) for approval. Siddharth can approve the requested amount, approve a revised amount, reject the request, request changes, or add comments.**

**Once approved, the actual spend will be tracked against the approved amount. Invoices/receipts and PO information will be captured by the relevant teams, enabling Finance and Marketing leadership to reconcile Approved → Committed → Actual Spend → Balance.**

**The system will provide leadership with a consolidated view of marketing investment by initiative, category, requester, business unit, geography, vendor, campaign and fiscal period.**

---

# **2\. Business Objectives**

**The portal should address the following business needs:**

1. **Centralize marketing spend**  
   * **Eliminate fragmented Excel sheets, emails and WhatsApp-based approvals.**  
   * **Maintain one source of truth.**  
2. **Create approval discipline**  
   * **Every marketing expense must have a documented request and approval before spend is committed.**  
3. **Improve spend visibility**  
   * **Leadership should know what is being spent, where, by whom, against which initiative and with what expected outcome. Cover Admin, HR, TA, sales, client success, India and outside india conferences, sponsorships etc**  
4. **Track ROI / outcomes**  
   * **Capture expected and actual business outcomes wherever applicable.**  
5. **Improve financial control**  
   * **Track approved amount, PO value, committed amount, actual invoice value and remaining budget.**  
6. **Create auditability**  
   * **Maintain a complete, immutable history of requests, approvals, changes, documents and transactions.**  
7. **Enable management reporting**  
   * **Provide real-time dashboards for Finance and leadership.**

---

# **3\. Guiding Principle**

### **No Marketing Spend Without a Request → Approval → Spend → Reconciliation Trail**

**The system should be designed around this lifecycle:**

**Initiative → Spend Request → Approval → PO/Commitment → Spend → Invoice/Receipt → Actual → Reconciliation → Closure**

---

# **4\. Users & Personas**

| Persona | Primary Responsibilities |
| ----- | ----- |
| **Employee / Requester** | **Create initiatives and spend requests, provide justification/documents, track status** |
| **CEO / Executive Approver – Siddharth Sethi** | **Review, approve/reject/request changes, modify approved amount, comment** |
| **Admin** | **Manage categories, initiatives, vendors, campaigns, supporting documents and reporting** |
| **Finance** | **Validate financial information, PO, invoice, actual spend and reconciliation** |
| **System Administrator** | **User access, configuration, workflows, audit and system administration** |

---

# **5\. High-Level System Architecture**

### **Employee Flow**

**InfoBeans SSO Login → My Requests → New Initiative / Existing Initiative → Select Category → Dynamic Form → Attach Documents (optional) → Submit → Track Status**

### **Approval Flow**

**Notification → Siddharth Dashboard → Review Request → Comment / Request Changes / Approve / Approve Different Amount / Reject**

### **Post-Approval Flow (not to be included in this system, rather route to procurement portal or finance)**

**Approved → PO / Spend Commitment → Spend Occurs → Invoice/Receipt Uploaded → Actual Amount Recorded → Reconciliation → Closed**

### **Finance Flow  (not to be included in this system, rather route to procurement portal or finance)**

**Approved Request → PO → Invoice → Actual Spend → Reconciliation → Financial Reporting**

---

# **6\. Core Concept: Initiative vs. Spend Request**

**This distinction is important.**

### **Initiative**

**An Initiative represents the overall marketing activity/campaign.**

**Examples:**

* **ITC Vegas 2026**  
* **Knowledge 2026**  
* **ServiceNow BFSI Campaign – Middle East**  
* **Insurance AI paid Campaign on LinkedIn**  
* **Dreamforce 2026 swag items**  
* **Innovation day print material**  
* **Customer Executive Dinner – Zurich**  
* **Hiring auto rickshaw for Go green initiative**  
* **Hoarding on road**  
* **Investor meet video photography**

**An initiative may have multiple spend requests or can be just a stand along item.**

### **Spend Request**

**An individual financial request associated with an initiative.**

**Example:**

**Initiative: ITC Vegas 2026**

| Spend Request | Amount |
| ----- | ----- |
| **Booth** | **₹8,00,000** |
| **Sponsorship** | **₹5,00,000** |
| **Travel** | **₹3,00,000** |
| **Collateral** | **₹75,000** |
| **Customer Dinner** | **₹1,00,000** |

**This allows leadership to see both individual expenses and total initiative investment.**

---

# **7\. Employee Dashboard**

**After SSO login, the employee should see:**

### **My Requests**

| Request | Initiative | Category | Amount | Date | Status |
| ----- | ----- | ----- | ----- | ----- | ----- |
| **ITC Booth** | **ITC Vegas 2026** | **Event** | **₹8L** | **Sep 2** | **Approved** |
| **LinkedIn Campaign** | **BFSI Campaign** | **Advertising** | **₹2L** | **Sep 3** | **Pending** |
| **Customer Dinner** | **Zurich** | **Customer Event** | **₹50K** | **Aug 28** | **Closed** |

### **Dashboard Summary**

* **Total Requested**  
* **Total Approved**  
* **Total Spent**  
* **Pending Approval**  
* **Amount Remaining**  
* **Requests Requiring Action**

---

# **8\. New Initiative Creation**

**A team member should be able to create an approval before raising spend against it.**

### **Initiative Fields**

**Basic Information**

* **Initiative Name**  
* **Initiative Type**  
* **Business Unit**  
* **Geography / Region**  
* **Requester / Owner**  
* **Start Date**  
* **End Date**  
* **Target Audience**  
* **Objective**  
* **Expected Business Outcome**  
* **Estimated Total Initiative Budget**

**Business Information**

* **Client / Prospect / Market**  
* **Strategic Account, if applicable**  
* **Campaign / Program**  
* **Expected Leads / Meetings / Opportunities, where applicable**  
* **Strategic rationale**

**Supporting Documents**

* **Proposal**  
* **Event details**  
* **Vendor quotation**  
* **Sponsorship proposal**  
* **Campaign plan**  
* **Other supporting material**

---

# **9\. Spend Request Form**

**Once an initiative exists, the requester can add one or more spend requests.**

## **Section A – Basic Information**

* **Initiative**  
* **Category**  
* **Subcategory / Spend Type**  
* **Request Title**  
* **Purpose**  
* **Vendor**  
* **Business Unit**  
* **Region**  
* **Expected Spend Date**  
* **Duration**  
* **Client / Prospect, where applicable**

---

## **Section B – Financial Information**

* **Estimated Amount**  
* **Currency**  
* **Taxes**  
* **Total Estimated Amount**  
* **Payment Method**  
* **Expected Spend Breakdown**  
* **Existing PO? Yes/No**  
* **PO Number, if applicable**  
* **Budget / Initiative Reference**  
* **Vendor quotation amount**

### **Spend Breakdown**

**Example:**

| Item | Amount |
| ----- | ----- |
| **Registration** | **₹2,00,000** |
| **Booth** | **₹5,00,000** |
| **Travel** | **₹1,50,000** |
| **Collateral** | **₹50,000** |
| **Total** | **₹9,00,000** |

**The system should automatically calculate the total rather than relying on manual calculation.**

---

# **10\. Business Justification**

**This should be mandatory.**

### **Questions**

**Why is this spend required?**

**What business outcome is expected?**

**How will success be measured?**

**Depending on the category, the system can dynamically ask additional questions.**

**For example:**

### **Conference**

* **Number of attendees**  
* **Expected customer meetings**  
* **Target accounts**  
* **Expected leads**  
* **Speaking opportunity?**  
* **Booth?**  
* **Sponsorship level?**

### **Advertising**

* **Campaign objective**  
* **Target geography**  
* **Target audience**  
* **Campaign duration**  
* **Expected impressions/leads**  
* **Landing page**  
* **Expected CPL / conversion**

### **Customer Event**

* **Customer/prospect name**  
* **Purpose**  
* **Number of attendees**  
* **Expected business outcome**  
* **Account opportunity**

---

# **11\. Dynamic Category-Based Forms**

**The portal should not show the same 30–40 questions for every request.**

**The requester first selects:**

> **Category → Subcategory / Spend Type**

**The system then dynamically displays relevant fields.**

**For example:**

**Conference → Booth**

**would show booth-related questions.**

**Digital Marketing → LinkedIn Advertising**

**would show campaign-related questions.**

**Customer Event → Executive Dinner**

**would show customer, attendees and business-outcome fields.**

---

# **12\. Marketing Spend Categories**

**The system should support the following primary categories:**

1. **Conferences & Events**  
2. **Advertising & Paid Promotion**  
3. **Content & Creative**  
4. **Branding & Merchandise**  
5. **Travel & Accommodation**  
6. **Customer / Prospect Engagement**  
7. **Digital Marketing**  
8. **Marketing Technology**  
9. **PR & Communications**  
10. **Analyst / Industry Relations**  
11. **Partnerships & Co-Marketing**  
12. **Website & Digital Presence**  
13. **Awards & Recognition**  
14. **Research & Intelligence**  
15. **Memberships & Associations**  
16. **Internal Marketing Initiatives**  
17. **Other**

**The detailed Spend Types / Examples provided in the requirement should be configured as subcategories under these heads.**

---

# **13\. Supporting Documents**

**The requester should be able to attach:**

* **Vendor quotation**  
* **Event proposal**  
* **Sponsorship proposal**  
* **Email confirmation**  
* **Contract**  
* **Campaign plan**  
* **Travel quotation**  
* **Other supporting documents**

### **System Rules**

* **Attachments should be version controlled.**  
* **Documents should remain linked to the request.**  
* **Deleted/replaced documents should remain part of the audit history.**  
* **Certain categories should make attachments mandatory.**

---

# **14\. Approval Workflow**

### **Statuses**

**The system should support:**

**Draft → Submitted → Under Review → Changes Requested → Resubmitted → Approved → Rejected → Spend in Progress → Partially Spent → Reconciled → Closed**

### **Siddharth's Actions**

**For every request:**

* **Approve requested amount**  
* **Approve a different amount**  
* **Reject**  
* **Request changes**  
* **Add comment**  
* **View attachments**  
* **View requester history**  
* **View initiative-level spend**  
* **View previous related requests**

---

# **15\. Approval Amount Control**

**If Siddharth receives:**

> **Requested: ₹5,00,000**

**He should be able to enter:**

> **Approved: ₹4,00,000**

**The system should record both amounts.**

| Field | Amount |
| ----- | ----- |
| **Requested** | **₹5,00,000** |
| **Approved** | **₹4,00,000** |
| **Actual** | **₹3,75,000** |
|  |  |

---

# **16\. Post-Approval Spend Tracking (This need not build into this  marketing spend system, this can be tracked separately in either procurement portal or by Finance team)**

**Once approved, the request moves into spend tracking.**

**The system should capture:**

### **Commitment**

* **PO Number**  
* **PO Date**  
* **PO Amount**  
* **Vendor**  
* **PO Start Date**  
* **PO End Date**

### **Actual Spend**

* **Invoice Number**  
* **Invoice Date**  
* **Invoice Amount**  
* **Tax**  
* **Total Amount**  
* **Payment Date**  
* **Receipt / Invoice**  
* **Actual Spend Date**

---

# **18\. Spend Control Alerts**

**The system should generate alerts when:**

* **Approval is pending**  
* **Actual spend exceeds approved amount**  
* **Initiative is approaching its end date**  
* **Initiative has significant unutilized budget**

---

# **19\. Marketing Leadership Dashboard**

**This should be the executive view.**

### **Top-Level KPIs**

**FY Spend**

**Approved**

**Actual**

**Available**

---

## **Spend by Category**

**Example:**

| Category | Approved | Actual | Balance |
| ----- | ----- | ----- | ----- |
| **Events** | **₹40L** | **₹32L** | **₹8L** |
| **Advertising** | **₹20L** | **₹12L** | **₹8L** |
| **Travel** | **₹15L** | **₹10L** | **₹5L** |
| **Content** | **₹10L** | **₹7L** | **₹3L** |

---

# **20\. Dashboard Filters**

**Leadership should be able to filter by:**

* **Fiscal Year**  
* **Quarter**  
* **Month**  
* **Category**  
* **Subcategory**  
* **Initiative**  
* **Requester**  
* **Business Unit**  
* **Region**  
* **Customer / Prospect**  
* **Status**  
* **Approved / Actual**

---

# **22\. Initiative-Level View**

**Clicking an initiative should open a complete 360° view.**

### **Example: ITC Vegas 2026**

**Total Approved: ₹18L**  
 **Actual: ₹14.2L**  
 **Balance: ₹3.8L**

**Then:**

| Request | Category | Approved | Actual | Status |
| ----- | ----- | ----- | ----- | ----- |
| **Booth** | **Event** | **₹8L** | **₹8L** | **Closed** |
| **Sponsorship** | **Event** | **₹5L** | **₹5L** | **Closed** |
| **Travel** | **Travel** | **₹3L** | **₹1.2L** | **Open** |
| **Collateral** | **Branding** | **₹2L** | **—** | **Pending** |

**This is one of the most important views in the application.**

---

# **25\. Audit Trail**

**Every request must have a complete audit trail.**

**Example:**

> **Sept 2, 4:31 PM — Request submitted by Paarth**  
>  **Sept 2, 4:32 PM — Notification sent to Siddharth**  
>  **Sept 2, 5:10 PM — Siddharth requested changes**  
>  **Sept 3, 10:04 AM — Paarth resubmitted**  
>  **Sept 3, 11:21 AM — Siddharth approved ₹2,00,000**  
>  **Sept 5, 2:30 PM — PO created**  
>  **Sept 18, 4:10 PM — Invoice uploaded**  
>  **Sept 20, 10:15 AM — Actual spend recorded ₹1,82,500**  
>  **Sept 20, 11:00 AM — Request reconciled and closed**

### **Audit trail should capture:**

* **User**  
* **Timestamp**  
* **Action**  
* **Previous value**  
* **New value**  
* **Comments**  
* **Documents uploaded**  
* **Approval decisions**

**Audit records should be read-only.**

---

# **26\. Notifications**

**Notifications should be available through:**

* **Email**  
* **In-portal notifications**

# **28\. Integration Requirements**

### **Mandatory**

**InfoBeans SSO / Identity Provider**

* **Login using corporate credentials**  
* **No separate username/password**

**Email**

* **Notifications and approval workflow**

**Document Storage**

* **Google Drive**


---

# **30\. Search**

**Global search should allow users to search by:**

* **Request ID**  
* **Initiative**  
* **Request title**  
* **Requester**  
* **Vendor**  
* **PO number**  
* **Invoice number**  
* **Customer**  
* **Category**

---

# **31\. Reporting & Export**

**Users with appropriate access should be able to export:**

* **Current FY spend**  
* **Category-wise spend**  
* **Requester-wise spend**  
* **Initiative-wise spend**  
* **Vendor-wise spend**  
* **Approved vs Actual**  
* **Monthly spend**  
* **Quarterly spend**  
* **Pending requests**  
* **Reconciliation report**

**Export formats:**

**Excel / CSV / PDF**

---

# **32\. Security & Access Control**

### **Employee**

**Can:**

* **Create requests**  
* **View own requests**  
* **Modify drafts**  
* **Respond to changes**  
* **Upload documents**

**Cannot:**

* **Modify approval decisions**  
* **View restricted financial information of other users unless authorized**

### **Siddharth**

**Can:**

* **View all requests**  
* **Approve/reject**  
* **Request changes**  
* **Modify approval amount**  
* **View all spend dashboards**

### **Admin**

**Can:**

* **View/manage initiatives**  
* **Manage categories**  
* **Manage vendors**  
* **View reporting**

---

