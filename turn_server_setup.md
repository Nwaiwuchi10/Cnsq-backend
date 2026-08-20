# How to Set Up Your Own TURN Server (Coturn)

To guarantee 100% call reliability worldwide, you need to set up a TURN server. The industry standard, open-source tool for this is **Coturn**. 

Here is the exact step-by-step process to set it up.

---

## Step 1: Get a Virtual Private Server (VPS)
You need a small Linux server with a **public IP address**. 
1. Go to a cloud provider like **DigitalOcean**, **AWS**, **Hetzner**, or **Linode**.
2. Create a new server (Droplet/EC2 instance).
   - **OS:** Ubuntu 22.04 LTS (or 24.04 LTS)
   - **Size:** The cheapest $4 to $6/month plan is perfect (1GB RAM is plenty for hundreds of concurrent calls).
3. Once the server is running, note down its **Public IPv4 Address**.

---

## Step 2: Open Firewall Ports
Before installing Coturn, you must open the necessary ports on your cloud provider's firewall settings (and the Ubuntu `ufw` firewall if enabled) to allow video traffic to flow through.

Open these ports:
- **Port 3478 (TCP and UDP):** The primary listening port for STUN/TURN.
- **Port 5349 (TCP and UDP):** For TLS/DTLS (secure encrypted connections).
- **Ports 49152 - 65535 (UDP):** The dynamic relay port range where the actual video/audio data flows.

*If you are using AWS, you must do this in the EC2 Security Group settings.*

---

## Step 3: Install Coturn
Connect to your server via SSH:
```bash
ssh root@your-server-ip
```

Update your server and install the Coturn package:
```bash
sudo apt update
sudo apt install coturn -y
```

Next, tell Ubuntu that Coturn is allowed to run as a daemon (background service):
```bash
sudo nano /etc/default/coturn
```
Find the line `#TURNSERVER_ENABLED=1` and remove the `#` so it looks exactly like this:
```text
TURNSERVER_ENABLED=1
```
Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## Step 4: Configure the TURN Server
Now we need to tell Coturn how to operate and set a username/password for your app.

First, back up the original configuration file:
```bash
sudo mv /etc/turnserver.conf /etc/turnserver.conf.backup
```

Now create a fresh, clean configuration file:
```bash
sudo nano /etc/turnserver.conf
```

Paste the following configuration into the file. **Make sure to replace `YOUR_SERVER_IP`, `YOUR_USERNAME`, and `YOUR_PASSWORD`** with your actual server IP and the credentials you want to use for your app.

```text
# --- Basic settings ---
listening-port=3478
tls-listening-port=5349

# --- Your Server IP (Replace this!) ---
listening-ip=YOUR_SERVER_IP
relay-ip=YOUR_SERVER_IP
external-ip=YOUR_SERVER_IP

# --- Port range for video/audio data ---
min-port=49152
max-port=65535

# --- Security and Authentication ---
# Use long-term credentials mechanism
lt-cred-mech

# Define your static username and password (Replace these!)
# Format: username:password
user=YOUR_USERNAME:YOUR_PASSWORD

# Set a realm (usually your domain name, or just your IP if no domain)
realm=cnsquad-calls.com

# --- Performance tuning ---
# Limit the total number of concurrent relay allocations
total-quota=100
# Limit per-user concurrent connections
user-quota=50
```

Save and exit the file.

---

## Step 5: Start the Server
Restart the Coturn service so it applies your new configuration:
```bash
sudo systemctl restart coturn
```

Check the status to make sure it is running without errors:
```bash
sudo systemctl status coturn
```
*(You should see a green "active (running)" message)*

---

## Step 6: Connect Your Frontend
Now that your server is running, you just need to add the credentials to your frontend `.env` file in your Next.js project.

Open your local frontend `.env` file (or your Vercel/production environment variables) and add:

```env
# Replace with your actual Server IP, Username, and Password
NEXT_PUBLIC_TURN_SERVER=turn:YOUR_SERVER_IP:3478
NEXT_PUBLIC_TURN_USER=YOUR_USERNAME
NEXT_PUBLIC_TURN_PASS=YOUR_PASSWORD
```

**That's it!** 
The code I wrote in `webrtc.utils.ts` will automatically detect these environment variables. It will pass both the Google STUN servers and your new custom TURN server to the browser. 

The browser is smart enough to try the free Google STUN first, and if the user is trapped behind a strict corporate firewall, it will instantly fall back to routing the video through your brand new TURN server.
