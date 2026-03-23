# AWS Free Tier Deployment Guide

This app (Express.js + React, in-memory storage) can be hosted on AWS completely free for 12 months using the AWS Free Tier.

---

## What You Get for Free

| Service | Free Tier Limit |
|---------|----------------|
| EC2 t2.micro | 750 hours/month (12 months) |
| Elastic Beanstalk | Free (pay only for EC2) |
| S3 | 5 GB storage, 20,000 GET requests |
| Data Transfer | 1 GB/month out |

> **No database required** — this app uses in-memory storage, perfect for a demo.

---

## Option A: AWS Elastic Beanstalk (Recommended — Easiest)

Elastic Beanstalk manages EC2, networking, and health checks for you.

### Prerequisites
- AWS account (free at aws.amazon.com)
- AWS CLI installed: `pip install awscli` then `aws configure`
- EB CLI installed: `pip install awsebcli`

### Steps

**1. Create a zip of your source code (excluding node_modules and dist)**

```bash
zip -r app.zip . \
  --exclude "node_modules/*" \
  --exclude "dist/*" \
  --exclude ".git/*" \
  --exclude "*.zip"
```

**2. Initialize Elastic Beanstalk in your project**

```bash
eb init flipside-governance --platform "Node.js 20" --region us-east-1
```

When prompted:
- Select your region (us-east-1 is good default)
- Choose "Node.js 20" as the platform
- Answer "No" to CodeCommit

**3. Create the environment (this provisions the free EC2 instance)**

```bash
eb create flipside-demo \
  --instance-type t2.micro \
  --single-instance
```

> `--single-instance` skips the load balancer, keeping it free.

**4. Set the NODE_ENV environment variable**

```bash
eb setenv NODE_ENV=production
```

**5. Deploy**

```bash
eb deploy
```

**6. Open the app**

```bash
eb open
```

### Redeploying After Changes

```bash
eb deploy
```

### Useful Commands

```bash
eb status          # Check environment health
eb logs            # View application logs
eb ssh             # SSH into the EC2 instance
eb terminate       # Shut down the environment (stops billing)
```

---

## Option B: Docker on EC2 (More Control)

Use this if you want a Docker-based setup or plan to add a database later.

### Steps

**1. Launch a free EC2 t2.micro instance**
- Go to AWS Console → EC2 → Launch Instance
- Choose: Amazon Linux 2023 AMI (Free tier eligible)
- Instance type: t2.micro (Free tier eligible)
- Create or select a key pair (save the .pem file)
- Security group: Allow ports 22 (SSH) and 80 (HTTP)

**2. SSH into the instance**

```bash
ssh -i your-key.pem ec2-user@<your-ec2-public-ip>
```

**3. Install Docker**

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
# Log out and back in for group to take effect
exit
ssh -i your-key.pem ec2-user@<your-ec2-public-ip>
```

**4. Clone and run the app**

```bash
git clone https://github.com/<your-username>/ai-test-anthony.git
cd ai-test-anthony
docker build -t flipside-app .
docker run -d -p 80:5000 --name flipside --restart unless-stopped flipside-app
```

**5. Access the app**

Visit `http://<your-ec2-public-ip>` in your browser.

**6. Set up a domain (optional, free with Route 53 or use EC2 public DNS)**

Your app is already accessible at the EC2 public DNS shown in the console.

---

## Option C: No-Install Quick Deploy via AWS Console

1. Go to AWS Console → Elastic Beanstalk → Create Application
2. Application name: `flipside-governance`
3. Platform: Node.js 20
4. Upload your code as a zip (see step 1 in Option A)
5. Configure instance type: t2.micro
6. Click "Create environment"

---

## Environment Variables

Set these in Elastic Beanstalk (Configuration → Software → Environment properties) or via `eb setenv`:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `PORT` | Set automatically by EB (8080) | Auto |

If you later add AI features, also set:
| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Your OpenAI key |
| `ANTHROPIC_API_KEY` | Your Anthropic key |

---

## Cost Estimate

For a **demo** running 24/7 for 12 months on free tier:

- EC2 t2.micro: **$0** (750 hrs/month free)
- Elastic Beanstalk: **$0** (free service)
- Data transfer: **$0** (under 1GB/month for a demo)

**After 12 months:** ~$8-10/month for t2.micro, or shut it down.

---

## Architecture

```
Internet → EC2 t2.micro (port 80/443)
              └── Node.js Express server (port 8080 internally)
                    ├── /api/* → Backend routes
                    └── /* → React SPA (served from dist/public/)
```

No separate database or CDN needed for this demo.
